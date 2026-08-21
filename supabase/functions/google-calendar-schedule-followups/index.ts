import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAsAppUser } from "../_shared/appUserConnector.ts";
import {
  adminClient,
  getAuthedUser,
  getConnectionKeyForUser,
} from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function shiftMonths(date: string, months: number) {
  const d = new Date(`${date}T09:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function eventBody(summary: string, description: string, start: Date) {
  const end = new Date(start.getTime() + 30 * 60000);
  return {
    summary,
    description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 * 24 }] },
  };
}

async function upsertEvent(
  connectionAPIKey: string,
  existingId: string | null,
  payload: Record<string, unknown>,
): Promise<string> {
  const path = existingId
    ? `/calendar/v3/calendars/primary/events/${encodeURIComponent(existingId)}`
    : "/calendar/v3/calendars/primary/events";
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path,
    init: {
      method: existingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    // A deleted/missing event should fall back to creating a fresh one.
    if (existingId && (res.status === 404 || res.status === 410)) {
      return upsertEvent(connectionAPIKey, null, payload);
    }
    throw new Error(`[${res.status}]: ${text}`);
  }
  const created = await res.json();
  return created.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => ({}));
    const dealId = typeof body?.dealId === "string" ? body.dealId : "";
    if (!/^[0-9a-f-]{36}$/i.test(dealId)) return json({ error: "A valid dealId is required" }, 400);

    const connectionAPIKey = await getConnectionKeyForUser(user.id, CONNECTOR_ID);
    if (!connectionAPIKey) return json({ connected: false }, 200);

    const db = adminClient();
    const { data: deal, error } = await db
      .from("realtor_deals")
      .select("*")
      .eq("id", dealId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!deal) return json({ error: "Deal not found" }, 404);

    const closedOn: string = deal.closed_at ?? String(deal.created_at).slice(0, 10);
    if (!isoDate.test(closedOn)) return json({ error: "Deal has no valid close date" }, 400);

    const who = deal.client_name ?? "Client";
    const address = deal.property_address ? ` — ${deal.property_address}` : "";
    const contact = [deal.client_email, deal.client_phone].filter(Boolean).join(" · ");

    const checkinId = await upsertEvent(
      connectionAPIKey,
      deal.checkin_event_id ?? null,
      eventBody(
        `6-month check-in: ${who}`,
        `Brivano reminder to check in with ${who}${address}.\n${contact}\nClosed/leased on ${closedOn}.`,
        shiftMonths(closedOn, 6),
      ),
    );

    const anniversaryId = await upsertEvent(
      connectionAPIKey,
      deal.anniversary_event_id ?? null,
      eventBody(
        `1-year anniversary: ${who}`,
        `Send ${who} an anniversary note or gift${address}.\n${contact}\nClosed/leased on ${closedOn}.`,
        shiftMonths(closedOn, 12),
      ),
    );

    await db
      .from("realtor_deals")
      .update({
        checkin_event_id: checkinId,
        anniversary_event_id: anniversaryId,
        calendar_synced_at: new Date().toISOString(),
      })
      .eq("id", dealId)
      .eq("user_id", user.id);

    return json({
      connected: true,
      checkinEventId: checkinId,
      anniversaryEventId: anniversaryId,
      checkinDate: shiftMonths(closedOn, 6).toISOString(),
      anniversaryDate: shiftMonths(closedOn, 12).toISOString(),
    });
  } catch (e) {
    console.error("google-calendar-schedule-followups failed:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
