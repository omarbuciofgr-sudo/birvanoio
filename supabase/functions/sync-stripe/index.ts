import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[SYNC-STRIPE] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

// Map Stripe product IDs to plan tiers
const TIER_MAP: Record<string, string> = {
  "prod_TkqoACAHdNPHsv": "starter",
  "prod_TkqpMe4AqSDUmv": "growth",
  "prod_TkqtBClmSUlwQu": "scale",
  "prod_TkqyoaMo9XVlQG": "starter",
  "prod_TkqzsHd16kE95P": "growth",
  "prod_Tkr1MJspbuRMt9": "scale",
};

const CREDITS_PER_SEAT: Record<string, number> = {
  starter: 500,
  growth: 2000,
  scale: 10000,
  enterprise: 999999,
};

function stripeBillingStatus(status: string): string {
  switch (status) {
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled":
    case "unpaid": return "canceled";
    case "trialing": return "trialing";
    default: return "incomplete";
  }
}

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
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      throw new Error("Authentication failed");
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin" as any,
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    log("Admin verified, starting sync", { userId: userData.user.id });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Parse optional workspace_id filter
    let targetWorkspaceId: string | null = null;
    try {
      const body = await req.json();
      targetWorkspaceId = body.workspace_id || null;
    } catch { /* no body */ }

    // Get workspaces with Stripe subscriptions
    let query = supabase
      .from("workspaces")
      .select("id, stripe_customer_id, stripe_subscription_id, plan_tier, billing_status, seats_purchased");

    if (targetWorkspaceId) {
      query = query.eq("id", targetWorkspaceId);
    } else {
      query = query.not("stripe_customer_id", "is", null);
    }

    const { data: workspaces, error: wsError } = await query;
    if (wsError) throw wsError;

    const results: Array<{ workspace_id: string; action: string; details: string }> = [];

    for (const ws of workspaces || []) {
      if (!ws.stripe_subscription_id) {
        // No subscription — ensure it's marked free/canceled
        if (ws.plan_tier !== "free" || ws.billing_status !== "canceled") {
          await supabase
            .from("workspaces")
            .update({ plan_tier: "free", billing_status: "canceled", updated_at: new Date().toISOString() })
            .eq("id", ws.id);
          results.push({ workspace_id: ws.id, action: "downgraded", details: "No Stripe subscription found" });
        } else {
          results.push({ workspace_id: ws.id, action: "no_change", details: "Already free/canceled" });
        }
        continue;
      }

      try {
        const sub = await stripe.subscriptions.retrieve(ws.stripe_subscription_id);
        const item = sub.items.data[0];
        const productId = item.price.product as string;
        const tier = TIER_MAP[productId] || "starter";
        const seats = item.quantity || 1;
        const billingStatus = stripeBillingStatus(sub.status);

        const updates: Record<string, unknown> = {};
        const changes: string[] = [];

        if (ws.plan_tier !== tier) {
          updates.plan_tier = tier;
          changes.push(`tier: ${ws.plan_tier} → ${tier}`);
        }
        if (ws.billing_status !== billingStatus) {
          updates.billing_status = billingStatus;
          changes.push(`billing_status: ${ws.billing_status} → ${billingStatus}`);
        }
        if (ws.seats_purchased !== seats) {
          updates.seats_purchased = seats;
          changes.push(`seats: ${ws.seats_purchased} → ${seats}`);
        }

        // Always sync period dates and IDs
        updates.stripe_subscription_item_id = item.id;
        updates.stripe_price_id = item.price.id;
        updates.current_period_start = new Date(sub.current_period_start * 1000).toISOString();
        updates.current_period_end = new Date(sub.current_period_end * 1000).toISOString();
        updates.updated_at = new Date().toISOString();

        if (changes.length > 0) {
          await supabase.from("workspaces").update(updates).eq("id", ws.id);
          results.push({ workspace_id: ws.id, action: "repaired", details: changes.join("; ") });
        } else {
          // Still update period dates
          await supabase.from("workspaces").update(updates).eq("id", ws.id);
          results.push({ workspace_id: ws.id, action: "synced", details: "Period dates refreshed" });
        }
      } catch (stripeErr) {
        const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        // Subscription not found in Stripe
        if (msg.includes("No such subscription")) {
          await supabase
            .from("workspaces")
            .update({
              plan_tier: "free",
              billing_status: "canceled",
              stripe_subscription_id: null,
              stripe_subscription_item_id: null,
              stripe_price_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", ws.id);
          results.push({ workspace_id: ws.id, action: "downgraded", details: "Subscription deleted in Stripe" });
        } else {
          results.push({ workspace_id: ws.id, action: "error", details: msg });
        }
      }
    }

    log("Sync complete", { total: results.length, repaired: results.filter(r => r.action === "repaired").length });

    return new Response(JSON.stringify({ results, synced_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
