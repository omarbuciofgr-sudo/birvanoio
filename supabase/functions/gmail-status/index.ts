import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { disconnectAppUser } from "../_shared/appUserConnector.ts";
import {
  deleteConnectionForUser,
  getAuthedUser,
  getConnectionKeyForUser,
  getConnectionRowForUser,
} from "../_shared/appUserConnections.ts";

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
    const action = body?.action === "disconnect" ? "disconnect" : "status";

    if (action === "disconnect") {
      const key = await getConnectionKeyForUser(user.id, CONNECTOR_ID);
      if (key) {
        try {
          await disconnectAppUser({
            gatewayBaseUrl: GATEWAY_BASE_URL,
            connectionAPIKey: key,
            connectorId: CONNECTOR_ID,
          });
        } catch (e) {
          console.error("gateway disconnect failed:", e);
        }
        await deleteConnectionForUser(user.id, CONNECTOR_ID);
      }
      return json({ connected: false });
    }

    const row = await getConnectionRowForUser(user.id, CONNECTOR_ID);
    return json({
      connected: !!row,
      accountEmail: row?.account_email ?? null,
      connectedAt: row?.updated_at ?? null,
    });
  } catch (e) {
    console.error("gmail-status failed:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
