import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.22.4";
import { chargeCredits } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const schema = z.object({
  actionKey: z.enum(["action_city_search", "action_owner_contact", "action_sms", "action_voice_minute"]),
  units: z.number().int().min(1).max(10000).default(1),
  referenceId: z.string().max(255).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data, error } = await client.auth.getUser(authHeader.replace("Bearer ", ""));
    if (error || !data.user) return new Response(JSON.stringify({ error: "Invalid authentication" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const result = await chargeCredits(data.user.id, parsed.data.actionKey, parsed.data.units, parsed.data.referenceId);
    return new Response(JSON.stringify(result), { status: result.success ? 200 : 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("consume-credits error", error);
    return new Response(JSON.stringify({ error: "Unable to update credits" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});