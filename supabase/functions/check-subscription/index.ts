import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Demo accounts that get full access
const DEMO_EMAILS_ENV = Deno.env.get("DEMO_ACCOUNT_EMAILS") || "";
const DEMO_EMAILS = DEMO_EMAILS_ENV.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const log = (step: string, details?: unknown) => {
  console.log(`[CHECK-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Function started");

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      throw new Error(`Authentication error: ${userError?.message ?? "Invalid token"}`);
    }

    const user = userData.user;
    const email = user.email ?? "";
    log("User authenticated", { userId: user.id, email });

    // Demo account bypass
    if (DEMO_EMAILS.includes(email.toLowerCase())) {
      log("Demo account detected");
      return new Response(
        JSON.stringify({
          subscribed: true,
          tier: "scale",
          subscription_end: new Date(Date.now() + 365 * 86400000).toISOString(),
          workspace_id: null,
          workspace_role: "owner",
          seats_purchased: 99,
          seats_used: 1,
          credits_remaining: 99999,
          credits_allowance: 99999,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Find workspace membership
    const { data: membership } = await supabase
      .from("workspace_memberships")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      log("No workspace membership found");
      return new Response(
        JSON.stringify({
          subscribed: false,
          tier: null,
          subscription_end: null,
          workspace_id: null,
          workspace_role: null,
          seats_purchased: 0,
          seats_used: 0,
          credits_remaining: 0,
          credits_allowance: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get workspace details
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", membership.workspace_id)
      .single();

    if (!workspace) {
      log("Workspace not found");
      return new Response(
        JSON.stringify({ subscribed: false, tier: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get seats used
    const { data: seatsData } = await supabase.rpc("get_workspace_seats_used", {
      _workspace_id: workspace.id,
    });

    // Get user's credit balance for current period
    const today = new Date().toISOString().slice(0, 10);
    const { data: credits } = await supabase
      .from("user_monthly_credits")
      .select("*")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace.id)
      .lte("period_start", today)
      .gte("period_end", today)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    const creditsAllowance = (credits?.monthly_allowance ?? 0) + (credits?.topup_credits ?? 0);
    const creditsUsed = credits?.credits_used ?? 0;

    const isSubscribed = workspace.plan_tier !== "free" && !!workspace.stripe_subscription_id;
    const billingStatus = workspace.billing_status || (isSubscribed ? "active" : "canceled");

    log("Returning subscription state", {
      tier: workspace.plan_tier,
      subscribed: isSubscribed,
      billingStatus,
      role: membership.role,
    });

    return new Response(
      JSON.stringify({
        subscribed: isSubscribed,
        tier: workspace.plan_tier,
        billing_status: billingStatus,
        subscription_end: workspace.current_period_end,
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        workspace_role: membership.role,
        seats_purchased: workspace.seats_purchased,
        seats_used: seatsData ?? 1,
        credits_remaining: Math.max(0, creditsAllowance - creditsUsed),
        credits_allowance: creditsAllowance,
        credits_used: creditsUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
