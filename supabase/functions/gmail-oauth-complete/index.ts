import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAsAppUser, exchangeAppUserOAuthCode } from "../_shared/appUserConnector.ts";
import { getAuthedUser, saveConnectionKeyForUser } from "../_shared/appUserConnections.ts";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_mail";

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

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code || code.length > 4096) return json({ error: "A valid code is required" }, 400);

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
    if (connectorId !== CONNECTOR_ID) {
      return json({ error: "OAuth completion returned the wrong connector" }, 400);
    }

    let accountEmail: string | null = null;
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
        path: "/gmail/v1/users/me/profile",
      });
      if (res.ok) {
        const profile = await res.json();
        accountEmail = typeof profile?.emailAddress === "string" ? profile.emailAddress : null;
      }
    } catch (_) {
      // non-fatal
    }

    await saveConnectionKeyForUser(user.id, CONNECTOR_ID, connectionAPIKey, accountEmail);
    return json({ ok: true, accountEmail });
  } catch (e) {
    console.error("gmail-oauth-complete failed:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
