import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[UPDATE-SEATS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) throw new Error("Authentication failed");

    const user = userData.user;
    log("User authenticated", { userId: user.id });

    // Get user's workspace membership
    const { data: membership } = await supabase
      .from("workspace_memberships")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Only workspace owners/admins can change seats" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Get workspace
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, stripe_subscription_id, stripe_subscription_item_id, seats_purchased")
      .eq("id", membership.workspace_id)
      .single();

    if (!workspace?.stripe_subscription_id || !workspace?.stripe_subscription_item_id) {
      return new Response(JSON.stringify({ error: "No active subscription found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { seats } = await req.json();
    const newSeats = Math.max(1, Math.min(100, Math.round(Number(seats))));

    if (newSeats === workspace.seats_purchased) {
      return new Response(JSON.stringify({ message: "No change", seats: newSeats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check that we're not going below current member count (excluding viewers)
    const { data: seatsUsed } = await supabase.rpc("get_workspace_seats_used", {
      _workspace_id: workspace.id,
    });

    if (newSeats < (seatsUsed || 1)) {
      return new Response(
        JSON.stringify({
          error: `Cannot reduce below ${seatsUsed} seats (current active members). Remove members first.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    log("Updating Stripe subscription", {
      subscriptionItemId: workspace.stripe_subscription_item_id,
      from: workspace.seats_purchased,
      to: newSeats,
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Update subscription item quantity with immediate proration
    await stripe.subscriptions.update(workspace.stripe_subscription_id, {
      items: [
        {
          id: workspace.stripe_subscription_item_id,
          quantity: newSeats,
        },
      ],
      proration_behavior: "always_invoice",
    });

    // Update workspace locally (webhook will also do this, but immediate UX)
    await supabase
      .from("workspaces")
      .update({ seats_purchased: newSeats, updated_at: new Date().toISOString() })
      .eq("id", workspace.id);

    log("Seats updated", { workspaceId: workspace.id, newSeats });

    return new Response(
      JSON.stringify({ success: true, seats: newSeats }),
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
