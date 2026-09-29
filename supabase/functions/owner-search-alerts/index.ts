import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { chargeCredits, serviceClient } from "../_shared/billing.ts";

const APP_URL = "https://brivano.io";
const ALERT_HOUR = 7;

type Listing = Record<string, any>;
type Alert = {
  id: string; user_id: string; location: string; listing_type: "sale" | "rental" | "both";
  match_level: "best" | "all"; timezone: string; baseline_done: boolean; last_run_date: string | null;
  unsubscribe_token: string;
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function localParts(tz: string) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
  } catch {
    return localParts("America/Chicago");
  }
}

const externalId = (r: Listing) =>
  String(r.rentcast_id || (r.address || "").trim().toLowerCase().replace(/\s+/g, " "));
const score = (r: Listing) => Number(r.confidence_score ?? r.fsbo_confidence ?? 0);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = serviceClient();
  const token = req.headers.get("x-job-token") ?? "";
  const { data: ok } = await db.rpc("verify_job_token", { p_name: "owner_alerts", p_token: token });
  if (!ok) return json({ error: "Unauthorized" }, 401);

  const scraperBase = (Deno.env.get("SCRAPER_BACKEND_URL") ?? "").replace(/\/+$/, "");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "alerts@brivano.io";

  const { data: alerts } = await db.from("owner_search_alerts").select("*").eq("is_active", true).limit(2000);
  const due = ((alerts ?? []) as Alert[]).filter((a) => {
    const { date, hour } = localParts(a.timezone);
    return hour >= ALERT_HOUR && a.last_run_date !== date;
  });

  // One provider fetch per city + type per day, shared across users.
  const cacheMem = new Map<string, Listing[]>();
  const today = new Date().toISOString().slice(0, 10);
  async function cityListings(location: string, type: "sale" | "rental"): Promise<Listing[] | null> {
    const key = `${location.trim().toLowerCase()}|${type}`;
    if (cacheMem.has(key)) return cacheMem.get(key)!;
    const { data: cached } = await db.from("city_search_cache").select("listings")
      .eq("location_key", location.trim().toLowerCase()).eq("listing_type", type).eq("fetched_on", today).maybeSingle();
    if (cached) { cacheMem.set(key, cached.listings as Listing[]); return cached.listings as Listing[]; }
    if (!scraperBase) return null;
    try {
      const res = await fetch(`${scraperBase}/api/zillow/search`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, type, save: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.listings)) { console.error("provider fetch failed", location, type, res.status); return null; }
      const rows = body.listings.map((r: Listing) => ({ ...r, listing_kind: r.listing_kind || type }));
      await db.from("city_search_cache").upsert({ location_key: location.trim().toLowerCase(), listing_type: type, fetched_on: today, listings: rows });
      cacheMem.set(key, rows);
      return rows;
    } catch (e) {
      console.error("provider fetch error", location, type, e);
      return null;
    }
  }

  const summary = { due: due.length, emailed: 0, baselined: 0, skipped_credits: 0, failed: 0 };

  for (const a of due) {
    const { date } = localParts(a.timezone);
    try {
      const types = a.listing_type === "both" ? (["sale", "rental"] as const) : [a.listing_type];
      const lists = await Promise.all(types.map((t) => cityListings(a.location, t)));
      if (lists.some((l) => l === null)) { summary.failed++; continue; } // retry next hour
      let rows = lists.flat() as Listing[];
      if (a.match_level === "best") rows = rows.filter((r) => score(r) >= 60);

      const ids = [...new Set(rows.map(externalId).filter(Boolean))];
      const { data: seen } = ids.length
        ? await db.from("owner_alert_seen").select("external_id").eq("alert_id", a.id).in("external_id", ids)
        : { data: [] as { external_id: string }[] };
      const seenSet = new Set((seen ?? []).map((s) => s.external_id));
      const fresh = rows.filter((r) => { const id = externalId(r); return id && !seenSet.has(id); });

      // First run only records what exists today, so the user isn't flooded.
      if (!a.baseline_done) {
        if (ids.length) await db.from("owner_alert_seen").upsert(ids.map((id) => ({ alert_id: a.id, external_id: id })), { ignoreDuplicates: true });
        await db.from("owner_search_alerts").update({ baseline_done: true, last_run_date: date }).eq("id", a.id);
        summary.baselined++;
        continue;
      }

      const charge = await chargeCredits(a.user_id, "action_saved_search_alert", 1, `alert:${a.id}:${date}`);
      if (!charge.success) {
        await db.from("owner_search_alerts").update({ last_run_date: date }).eq("id", a.id);
        summary.skipped_credits++;
        continue;
      }
      await db.from("owner_search_alerts").update({ last_run_date: date }).eq("id", a.id);
      if (!fresh.length) continue;

      await db.from("owner_alert_seen").upsert(fresh.map((r) => ({ alert_id: a.id, external_id: externalId(r) })), { ignoreDuplicates: true });
      // Make each listing openable from the email link.
      await db.from("owner_search_results").upsert(fresh.map((r) => ({
        user_id: a.user_id, external_id: externalId(r), search_location: a.location,
        listing_kind: r.listing_kind || null, listing_data: r,
      })), { onConflict: "user_id,external_id" });

      const { data: profile } = await db.from("profiles").select("email, first_name").eq("user_id", a.user_id).maybeSingle();
      if (!profile?.email || !resendKey) { summary.failed++; continue; }

      const city = a.location.split(",")[0].trim();
      const subject = `${fresh.length} new owner${fresh.length === 1 ? "" : "s"} in ${city} today`;
      const items = fresh.slice(0, 50).map((r) => {
        const kind = /rent/i.test(String(r.listing_kind)) ? "Renting" : "Selling";
        const price = r.price != null ? `$${Number(r.price).toLocaleString("en-US")}${kind === "Renting" ? "/mo" : ""}` : "Price not listed";
        const link = `${APP_URL}/dashboard/scraper?tab=real-estate&listing=${encodeURIComponent(externalId(r))}`;
        return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee"><a href="${link}" style="color:#1d4ed8;font-weight:600;text-decoration:none">${esc(r.address || "View owner")}</a><br><span style="color:#555;font-size:13px">${kind} · ${esc(price)}</span></td></tr>`;
      }).join("");
      const unsub = `${Deno.env.get("SUPABASE_URL")}/functions/v1/owner-alert-unsubscribe?token=${a.unsubscribe_token}`;
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
<h2 style="font-size:20px">${esc(subject)}</h2>
<p style="color:#555">New owner listings for your saved search: ${esc(a.location)}.</p>
<table style="width:100%;border-collapse:collapse">${items}</table>
${fresh.length > 50 ? `<p style="color:#555">And ${fresh.length - 50} more in Brivano.</p>` : ""}
<p style="font-size:12px;color:#888;margin-top:24px">You get this because you saved this search in Brivano. <a href="${unsub}" style="color:#888">Unsubscribe from this alert</a>.</p></div>`;

      const send = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [profile.email], subject, html, headers: { "List-Unsubscribe": `<${unsub}>` } }),
      });
      if (!send.ok) { console.error("alert email failed", send.status, (await send.text()).slice(0, 300)); summary.failed++; continue; }
      await db.from("owner_search_alerts").update({ last_sent_at: new Date().toISOString() }).eq("id", a.id);
      summary.emailed++;
    } catch (e) {
      console.error("alert run failed", a.id, e);
      summary.failed++;
    }
  }

  await db.from("city_search_cache").delete().lt("fetched_on", new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10));
  return json(summary);
});
