import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAsAppUser } from "../_shared/appUserConnector.ts";
import {
  adminClient,
  getAuthedUser,
  getConnectionKeyForUser,
  getConnectionRowForUser,
} from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const GMAIL = "google_mail";
const CALENDAR = "google_calendar";

/** How far ahead the automatic follow-up reminder is placed. */
const FOLLOW_UP_HOURS = 48;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Header = { name: string; value: string };

function header(headers: Header[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseAddresses(value: string): { email: string; name: string | null }[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const angled = part.match(/^(.*?)<([^>]+)>$/);
      const email = (angled ? angled[2] : part).trim().toLowerCase();
      const name = angled ? angled[1].trim().replace(/^"|"$/g, "") : "";
      return { email, name: name || null };
    })
    .filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email));
}

async function createCalendarEvent(
  calendarKey: string,
  summary: string,
  description: string,
  start: Date,
) {
  const end = new Date(start.getTime() + 30 * 60000);
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: calendarKey,
    connectorId: CALENDAR,
    path: "/calendar/v3/calendars/primary/events",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
      }),
    },
  });
  if (!res.ok) {
    const text = await res.text();
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

    const gmailKey = await getConnectionKeyForUser(user.id, GMAIL);
    if (!gmailKey) return json({ gmailConnected: false, calendarConnected: false, created: 0 });

    const calendarKey = await getConnectionKeyForUser(user.id, CALENDAR);
    if (!calendarKey) {
      return json({ gmailConnected: true, calendarConnected: false, created: 0 });
    }

    const gmailRow = await getConnectionRowForUser(user.id, GMAIL);
    const ownEmail = (gmailRow?.account_email ?? "").toLowerCase();

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body?.days) || 7, 1), 30);

    const db = adminClient();

    // Known client / lead contacts for this user.
    const contacts = new Map<string, { name: string | null; dealId: string | null; leadId: string | null }>();

    const { data: deals } = await db
      .from("realtor_deals")
      .select("id, client_name, client_email")
      .eq("user_id", user.id)
      .not("client_email", "is", null);
    for (const d of deals ?? []) {
      const email = String(d.client_email).toLowerCase();
      contacts.set(email, { name: d.client_name ?? null, dealId: d.id, leadId: null });
    }

    const { data: orgId } = await db.rpc("get_user_organization", { p_user_id: user.id });
    if (orgId) {
      const { data: leads } = await db
        .from("leads")
        .select("id, contact_name, business_name, email")
        .eq("client_id", orgId)
        .not("email", "is", null)
        .limit(2000);
      for (const l of leads ?? []) {
        const email = String(l.email).toLowerCase();
        if (contacts.has(email)) continue;
        contacts.set(email, {
          name: l.contact_name ?? l.business_name ?? null,
          dealId: null,
          leadId: l.id,
        });
      }
    }

    if (contacts.size === 0) {
      return json({ gmailConnected: true, calendarConnected: true, created: 0, scanned: 0 });
    }

    // Recent inbox + sent activity.
    const listRes = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: gmailKey,
      connectorId: GMAIL,
      path: `/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(
        `newer_than:${days}d -in:chats -category:promotions -category:social`,
      )}`,
    });
    if (!listRes.ok) {
      const text = await listRes.text();
      console.error(`Gmail list failed [${listRes.status}]: ${text}`);
      return json({ error: "Gmail request failed", status: listRes.status, details: text }, listRes.status);
    }
    const list = await listRes.json();
    const messages: { id: string; threadId: string }[] = list.messages ?? [];

    let created = 0;
    const seenThreads = new Set<string>();

    for (const m of messages) {
      if (seenThreads.has(m.threadId)) continue;
      seenThreads.add(m.threadId);

      const msgRes = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: gmailKey,
        connectorId: GMAIL,
        path:
          `/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=metadata` +
          `&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      });
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const headers: Header[] = msg?.payload?.headers ?? [];

      const from = parseAddresses(header(headers, "From"));
      const to = parseAddresses(header(headers, "To"));
      const subject = header(headers, "Subject") || "(no subject)";

      // The other party: sender, unless the user sent it themselves.
      const counterparts = from[0] && from[0].email !== ownEmail ? from : to;
      const match = counterparts.find((c) => contacts.has(c.email));
      if (!match) continue;

      const contact = contacts.get(match.email)!;

      // Already tracked for this thread? Skip so we never duplicate reminders.
      const { data: existing } = await db
        .from("gmail_followups")
        .select("id")
        .eq("user_id", user.id)
        .eq("thread_id", m.threadId)
        .maybeSingle();
      if (existing) continue;

      const followUpAt = new Date(Date.now() + FOLLOW_UP_HOURS * 3600 * 1000);
      const who = contact.name ?? match.name ?? match.email;

      let eventId: string | null = null;
      try {
        eventId = await createCalendarEvent(
          calendarKey,
          `Follow up: ${who}`,
          `Brivano detected new email activity with ${who} (${match.email}).\nSubject: ${subject}`,
          followUpAt,
        );
      } catch (e) {
        console.error("calendar event creation failed:", e);
        continue;
      }

      await db.from("gmail_followups").insert({
        user_id: user.id,
        thread_id: m.threadId,
        message_id: m.id,
        contact_email: match.email,
        contact_name: who,
        subject,
        deal_id: contact.dealId,
        lead_id: contact.leadId,
        calendar_event_id: eventId,
        follow_up_at: followUpAt.toISOString(),
      });
      created += 1;
    }

    return json({
      gmailConnected: true,
      calendarConnected: true,
      scanned: messages.length,
      created,
    });
  } catch (e) {
    console.error("gmail-scan-followups failed:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
