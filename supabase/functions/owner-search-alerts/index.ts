import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { chargeCredits, serviceClient, isCityBlocked } from "../_shared/billing.ts";
import { createCitySearch } from "../_shared/citySearch.ts";

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

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "alerts@brivano.io";

  const { data: alerts } = await db.from("owner_search_alerts").select("*").eq("is_active", true).limit(2000);
  const due = ((alerts ?? []) as Alert[]).filter((a) => {
    const { date, hour } = localParts(a.timezone);
    return hour >= ALERT_HOUR && a.last_run_date !== date;
  });

  const cityListings = createCitySearch(db);


  const followUpsSent = new Set<string>();
  const summary = { due: due.length, emailed: 0, baselined: 0, skipped_credits: 0, failed: 0 };

  for (const a of due) {
    const { date } = localParts(a.timezone);
    try {
      if (await isCityBlocked(a.user_id, a.location)) { summary.failed++; continue; } // city reserved by another member
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

      // Today's follow-ups go in the user's first alert email of the morning.
      let followUps: { due_date: string; note: string | null; lead_id: string; leads: { business_name: string; contact_name: string | null } | null }[] = [];
      if (!followUpsSent.has(a.user_id)) {
        const { data: fu } = await db.from("lead_follow_ups")
          .select("due_date, note, lead_id, leads(business_name, contact_name)")
          .eq("user_id", a.user_id).is("done_at", null).lte("due_date", date).order("due_date").limit(25);
        followUps = (fu ?? []) as typeof followUps;
      }
      // Assistant automation summaries from the last day.
      let autoHtml = "";
      if (!followUpsSent.has(a.user_id)) {
        const { data: runs } = await db.from("automation_runs").select("summary, automations(name)")
          .eq("user_id", a.user_id).eq("status", "done").not("summary", "is", null)
          .gte("created_at", new Date(Date.now() - 864e5).toISOString()).limit(10);
        if (runs?.length) autoHtml = `<h3 style="font-size:16px;margin-top:24px">Your automations</h3>` + runs.map((r: { summary: string; automations: { name: string } | null }) =>
          `<p style="color:#334155;font-size:14px"><strong>${esc(r.automations?.name || "Automation")}:</strong> ${esc(r.summary)}</p>`).join("");
      }
      if (!fresh.length && !followUps.length && !autoHtml) continue;

      // Gentle reminder if yesterday's daily goals were missed (user's time zone).
      let goalHtml = "";
      if (!followUpsSent.has(a.user_id)) {
        const { data: gp } = await db.from("profiles")
          .select("daily_contact_goal, daily_followup_goal, streak_counts_weekends, timezone").eq("user_id", a.user_id).maybeSingle();
        const { data: gd } = await db.rpc("goal_day_counts", { p_user_id: a.user_id, p_tz: gp?.timezone || a.timezone, p_days: 2 });
        const y = (gd ?? [])[0] as { day: string; contacted: number; followups: number } | undefined;
        const wd = y ? new Date(`${y.day}T12:00:00Z`).getUTCDay() : 1;
        const skipWeekend = !gp?.streak_counts_weekends && (wd === 0 || wd === 6);
        const cg = gp?.daily_contact_goal ?? 10, fg = gp?.daily_followup_goal ?? 5;
        if (y && !skipWeekend && (y.contacted < cg || y.followups < fg)) {
          goalHtml = `<p style="background:#f1f5f9;border-radius:8px;padding:12px;color:#334155;font-size:14px;margin-top:20px">Yesterday you contacted ${y.contacted} of ${cg} owners and completed ${y.followups} of ${fg} follow-ups. Today's a fresh start. <a href="${APP_URL}/dashboard" style="color:#1d4ed8">See today's goals</a>.</p>`;
        }
      }

      if (fresh.length) await db.from("owner_alert_seen").upsert(fresh.map((r) => ({ alert_id: a.id, external_id: externalId(r) })), { ignoreDuplicates: true });
      // Make each listing openable from the email link.
      if (fresh.length) await db.from("owner_search_results").upsert(fresh.map((r) => ({
        user_id: a.user_id, external_id: externalId(r), search_location: a.location,
        listing_kind: r.listing_kind || null, listing_data: r,
      })), { onConflict: "user_id,external_id" });

      const { data: profile } = await db.from("profiles").select("email, first_name").eq("user_id", a.user_id).maybeSingle();
      if (!profile?.email || !resendKey) { summary.failed++; continue; }

      const city = a.location.split(",")[0].trim();
      const subject = fresh.length
        ? `${fresh.length} new owner${fresh.length === 1 ? "" : "s"} in ${city} today`
        : followUps.length ? `${followUps.length} follow-up${followUps.length === 1 ? "" : "s"} due today` : "Your Brivano automations ran";
      const fuRows = followUps.map((f) => {
        const overdue = f.due_date < date;
        const link = `${APP_URL}/dashboard/owners/${encodeURIComponent(`lead:${f.lead_id}`)}`;
        const who = [f.leads?.contact_name, f.leads?.business_name].filter(Boolean).join(" · ") || "Lead";
        return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="${link}" style="color:#1d4ed8;font-weight:600;text-decoration:none">${esc(who)}</a>${overdue ? ` <span style="color:#b91c1c;font-size:12px">Overdue since ${esc(f.due_date)}</span>` : ""}${f.note ? `<br><span style="color:#555;font-size:13px">${esc(f.note)}</span>` : ""}</td></tr>`;
      }).join("");
      const fuHtml = followUps.length
        ? `<h3 style="font-size:16px;margin-top:24px">Today's follow-ups (${followUps.length})</h3><table style="width:100%;border-collapse:collapse">${fuRows}</table>`
        : "";
      const items = fresh.slice(0, 50).map((r) => {
        const kind = /rent/i.test(String(r.listing_kind)) ? "Renting" : "Selling";
        const price = r.price != null ? `$${Number(r.price).toLocaleString("en-US")}${kind === "Renting" ? "/mo" : ""}` : "Price not listed";
        const link = `${APP_URL}/dashboard/scraper?tab=real-estate&listing=${encodeURIComponent(externalId(r))}`;
        return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee"><a href="${link}" style="color:#1d4ed8;font-weight:600;text-decoration:none">${esc(r.address || "View owner")}</a><br><span style="color:#555;font-size:13px">${kind} · ${esc(price)}</span></td></tr>`;
      }).join("");
      const unsub = `${Deno.env.get("SUPABASE_URL")}/functions/v1/owner-alert-unsubscribe?token=${a.unsubscribe_token}`;
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
<h2 style="font-size:20px">${esc(subject)}</h2>
${fresh.length ? `<p style="color:#555">New owner listings for your saved search: ${esc(a.location)}.</p>
<table style="width:100%;border-collapse:collapse">${items}</table>` : `<p style="color:#555">No new owners for ${esc(a.location)} today.</p>`}
${fuHtml}
${autoHtml}
${goalHtml}
${fresh.length > 50 ? `<p style="color:#555">And ${fresh.length - 50} more in Brivano.</p>` : ""}
<p style="font-size:12px;color:#888;margin-top:24px">You get this because you saved this search in Brivano. <a href="${unsub}" style="color:#888">Unsubscribe from this alert</a>.</p></div>`;

      const send = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [profile.email], subject, html, headers: { "List-Unsubscribe": `<${unsub}>` } }),
      });
      if (!send.ok) { console.error("alert email failed", send.status, (await send.text()).slice(0, 300)); summary.failed++; continue; }
      await db.from("owner_search_alerts").update({ last_sent_at: new Date().toISOString() }).eq("id", a.id);
      followUpsSent.add(a.user_id);
      summary.emailed++;
    } catch (e) {
      console.error("alert run failed", a.id, e);
      summary.failed++;
    }
  }

  await db.from("city_search_cache").delete().lt("fetched_on", new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10));
  return json(summary);
});
