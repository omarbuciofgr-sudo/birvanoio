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
    const taskId = typeof body?.taskId === "string" ? body.taskId : "";
    const startAtRaw = typeof body?.startAt === "string" ? body.startAt : "";
    const durationMinutes = Number.isFinite(Number(body?.durationMinutes))
      ? Math.min(240, Math.max(15, Number(body.durationMinutes)))
      : 30;
    if (!/^[0-9a-f-]{36}$/i.test(taskId)) return json({ error: "A valid taskId is required" }, 400);

    const connectionAPIKey = await getConnectionKeyForUser(user.id, CONNECTOR_ID);
    if (!connectionAPIKey) return json({ connected: false }, 200);

    const db = adminClient();
    const { data: task, error } = await db
      .from("realtor_deal_events")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!task) return json({ error: "Follow-up not found" }, 404);

    const { data: deal } = await db
      .from("realtor_deals")
      .select("client_name, client_email, client_phone, property_address")
      .eq("id", task.deal_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const startCandidate = startAtRaw || task.scheduled_at || new Date().toISOString();
    const start = new Date(startCandidate);
    if (Number.isNaN(start.getTime())) return json({ error: "Invalid start time" }, 400);
    const end = new Date(start.getTime() + durationMinutes * 60000);

    const contact = [deal?.client_email, deal?.client_phone].filter(Boolean).join(" · ");
    const description = [
      task.body || task.notes || "",
      deal?.property_address ? `Property: ${deal.property_address}` : "",
      contact ? `Contact: ${contact}` : "",
      "Created by Brivano from a listing intel signal.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const eventId = await upsertEvent(connectionAPIKey, task.calendar_event_id ?? null, {
      summary: task.title,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "email", minutes: 60 * 24 },
        ],
      },
    });

    await db
      .from("realtor_deal_events")
      .update({
        calendar_event_id: eventId,
        calendar_synced_at: new Date().toISOString(),
        scheduled_at: start.toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", user.id);

    return json({ connected: true, eventId, startAt: start.toISOString() });
  } catch (e) {
    console.error("google-calendar-schedule-task failed:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
