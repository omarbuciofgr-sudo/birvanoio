import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export const AI_LIMIT_MESSAGE = "You've reached this month's AI message limit. Upgrade for more.";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

export async function chargeCredits(
  userId: string,
  actionKey: string,
  units = 1,
  referenceId?: string,
) {
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("consume_action_credits_for_user", {
    p_user_id: userId,
    p_action_key: actionKey,
    p_units: units,
    p_reference_id: referenceId ?? null,
  });
  if (error) throw error;
  return data as { success: boolean; error?: string; required?: number; remaining?: number };
}

export async function recordAiMessage(userId: string) {
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("consume_ai_message_for_user", { p_user_id: userId });
  if (error) throw error;
  return data as { success: boolean; error?: string; used: number; limit: number };
}

export async function getAiAllowance(userId: string) {
  const supabase = serviceClient();
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  const period = periodStart.toISOString().slice(0, 10);
  const [{ data: profile }, { data: membership }, { data: usage }] = await Promise.all([
    supabase.from("profiles").select("subscription_tier").eq("user_id", userId).maybeSingle(),
    supabase.from("workspace_memberships").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("ai_message_usage").select("messages_used").eq("user_id", userId).eq("period_start", period).maybeSingle(),
  ]);
  let seats = 1;
  if (membership?.workspace_id) {
    const { count } = await supabase.from("workspace_memberships").select("id", { count: "exact", head: true })
      .eq("workspace_id", membership.workspace_id).neq("role", "viewer");
    seats = Math.max(count ?? 1, 1);
  }
  const tier = profile?.subscription_tier ?? "free";
  const { data: setting } = await supabase.from("pricing_settings").select("ai_messages_per_seat")
    .eq("setting_key", `plan_${tier}`).maybeSingle();
  const limit = (setting?.ai_messages_per_seat ?? 20) * seats;
  return { used: usage?.messages_used ?? 0, limit };
}
export const CITY_LOCKED_MESSAGE = "This city is reserved exclusively by another Brivano member.";

/** True when another user holds an active exclusivity for this city. */
export async function isCityBlocked(userId: string, location: string) {
  const key = location.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!key) return false;
  const { data } = await serviceClient().from("city_exclusivities").select("user_id")
    .eq("city_key", key).in("status", ["active", "past_due"]).neq("user_id", userId).limit(1);
  return (data?.length ?? 0) > 0;
}
