import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeAppUserOAuth } from "../_shared/appUserConnector.ts";
import { getAuthedUser, getConnectionKeyForUser } from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ error: "Sign in required" }, 401);

    const clientAPIKey = Deno.env.get("GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY");
    if (!clientAPIKey) return json({ error: "Google Calendar connector is not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const origin = typeof body?.origin === "string" ? body.origin : "";
    let returnUrl: string;
    try {
      returnUrl = new URL("/oauth/google-calendar/return", origin).toString();
    } catch {
      return json({ error: "Invalid origin" }, 400);
    }

    const existingKey = await getConnectionKeyForUser(user.id, CONNECTOR_ID);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: user.id,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: existingKey ?? undefined,
      credentialsConfiguration: { scopes: SCOPES },
    });

    return json({ authorizationUrl });
  } catch (e) {
    console.error("google-calendar-oauth-start failed:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
