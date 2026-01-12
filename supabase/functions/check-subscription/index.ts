import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tier mapping based on Stripe product IDs
const TIER_MAP: Record<string, string> = {
  // Monthly products
  "prod_TkqoACAHdNPHsv": "starter",
  "prod_TkqpMe4AqSDUmv": "growth",
  "prod_TkqtBClmSUlwQu": "scale",
  // Yearly products
  "prod_TkqyoaMo9XVlQG": "starter",
  "prod_TkqzsHd16kE95P": "growth",
  "prod_Tkr1MJspbuRMt9": "scale",
};

// Demo accounts that get full "scale" tier access without Stripe subscription
// Read from environment variable to prevent hardcoding privileged account emails in source code
const DEMO_EMAILS_ENV = Deno.env.get("DEMO_ACCOUNT_EMAILS") || "";
const DEMO_EMAILS = DEMO_EMAILS_ENV.split(",").map(email => email.trim().toLowerCase()).filter(Boolean);

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Validating JWT claims");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: { persistSession: false },
      }
    );

    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      throw new Error(`Authentication error: ${claimsError?.message ?? "Invalid token"}`);
    }

    const userId = claimsData.claims.sub;
    const email = (claimsData.claims.email as string | undefined) ?? null;
    if (!userId || !email) throw new Error("User not authenticated or email not available");

    logStep("User authenticated", { userId, email });

    // Check if this is a demo account - grant full access without Stripe check
    if (DEMO_EMAILS.includes(email.toLowerCase())) {
      logStep("Demo account detected, granting full scale tier access", { email });
      return new Response(JSON.stringify({
        subscribed: true,
        tier: "scale",
        subscription_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: null,
        subscription_end: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let tier: string | null = null;
    let subscriptionEnd: string | null = null;
    let productId: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      productId = subscription.items.data[0].price.product as string;
      tier = TIER_MAP[productId] || null;
      logStep("Determined subscription tier", { productId, tier });
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      product_id: productId,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
