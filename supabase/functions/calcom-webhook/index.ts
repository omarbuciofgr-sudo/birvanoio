import { createClient } from "npm:@supabase/supabase-js@2";

const res = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const digits10 = (p?: string | null) => (p || "").replace(/\D/g, "").slice(-10);

// deno-lint-ignore no-explicit-any
function collectPhones(p: any): string[] {
  const out: string[] = [];
  const push = (v: unknown) => { if (typeof v === "string" && digits10(v).length === 10) out.push(v); };
  for (const a of p?.attendees ?? []) push(a?.phoneNumber);
  for (const v of Object.values(p?.responses ?? {})) push(typeof v === "object" && v ? (v as { value?: unknown }).value : v);
  push(p?.smsReminderNumber);
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return res({ ok: true });
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[a-f0-9]{48}$/.test(token)) return res({ error: "Unknown webhook" }, 404);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: integ } = await admin.from("booking_integrations").select("user_id, signing_secret").eq("webhook_token", token).maybeSingle();
  if (!integ) return res({ error: "Unknown webhook" }, 404);

  const raw = await req.text();
  const given = (req.headers.get("x-cal-signature-256") ?? "").toLowerCase();
  if (!given || !safeEqual(given, await hmacHex(integ.signing_secret, raw))) return res({ error: "Bad signature" }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = JSON.parse(raw); } catch { return res({ error: "Bad body" }, 400); }
  await admin.from("booking_integrations").update({ last_event_at: new Date().toISOString() }).eq("user_id", integ.user_id);

  const event = body?.triggerEvent;
  if (event === "PING") return res({ ok: true });
  if (event !== "BOOKING_CREATED" && event !== "BOOKING_RESCHEDULED") return res({ ok: true, ignored: event });

  const p = body.payload ?? {};
  const startsAt = p.startTime ? new Date(p.startTime) : null;
  if (!startsAt || isNaN(+startsAt)) return res({ ok: true, ignored: "no start time" });
  const externalId = `${p.uid ?? p.bookingId ?? "booking"}|${startsAt.toISOString()}`;
  const userId = integ.user_id as string;

  // Find the matching lead by email, then by phone.
  const emails = [...new Set((p.attendees ?? []).map((a: { email?: string }) => a?.email?.trim().toLowerCase()).filter(Boolean))] as string[];
  let leadId: string | null = null;
  for (const e of emails) {
    const { data } = await admin.from("leads").select("id").eq("client_id", userId).ilike("email", e).limit(1);
    if (data?.[0]) { leadId = data[0].id; break; }
  }
  if (!leadId) {
    const phones = new Set(collectPhones(p).map(digits10));
    if (phones.size) {
      const { data } = await admin.from("leads").select("id, phone").eq("client_id", userId).not("phone", "is", null).limit(5000);
      leadId = data?.find((l) => phones.has(digits10(l.phone)))?.id ?? null;
    }
  }

  const { error: dupErr } = await admin.from("booking_events").insert({ user_id: userId, external_id: externalId, lead_id: leadId, starts_at: startsAt.toISOString() });
  if (dupErr) return res({ ok: true, duplicate: true });
  if (!leadId) return res({ ok: true, matched: false });

  const { data: prof } = await admin.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
  const tz = prof?.timezone || "America/Chicago";
  let dayStr: string, timeStr: string, dateLabel: string;
  try {
    dayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(startsAt);
    timeStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(startsAt);
    dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(startsAt);
  } catch {
    dayStr = startsAt.toISOString().slice(0, 10); timeStr = startsAt.toISOString().slice(11, 16) + " UTC"; dateLabel = dayStr;
  }

  await admin.from("leads").update({ status: "appointment_set" }).eq("id", leadId).eq("client_id", userId).in("status", ["new", "contacted", "qualified"]);
  await admin.from("conversation_logs").insert({
    client_id: userId, lead_id: leadId, type: "note", direction: "inbound",
    subject: event === "BOOKING_RESCHEDULED" ? "Appointment rescheduled" : "Appointment booked",
    content: `${event === "BOOKING_RESCHEDULED" ? "Moved to" : "Booked through Cal.com for"} ${dateLabel} at ${timeStr}${p.title ? ` (${p.title})` : ""}.`,
  });
  await admin.from("lead_follow_ups").insert({ user_id: userId, lead_id: leadId, due_date: dayStr, note: `Appointment at ${timeStr} (booked on Cal.com)` });

  return res({ ok: true, matched: true });
});
