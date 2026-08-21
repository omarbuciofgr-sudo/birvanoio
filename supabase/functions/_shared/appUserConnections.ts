// Server-only storage for per-app-user connector connection keys.
import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptConnectionKey, encryptConnectionKey } from "./connectionKeyCrypto.ts";

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
  accountEmail?: string | null,
) {
  const { error } = await adminClient().from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: await encryptConnectionKey(connectionAPIKey),
      account_email: accountEmail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionKeyForUser(
  userId: string,
  connectorId: string,
): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? await decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function getConnectionRowForUser(userId: string, connectorId: string) {
  const { data, error } = await adminClient()
    .from("app_user_connections")
    .select("account_email, updated_at, connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  const { error } = await adminClient()
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
  if (error) throw error;
}

/** Verify the caller's JWT and return the authenticated user, or null. */
export async function getAuthedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}
