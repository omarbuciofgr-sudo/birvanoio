import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { priceId, seats = 1, checkoutType = "subscription", addonKey, city } = await req.json();
    if (checkoutType === "subscription" && !priceId) throw new Error("Price ID is required");

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    const user = data?.user;
    if (authError || !user?.email) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;

      // Check if already subscribed
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 20,
      });
      const planSubs = subs.data.filter((s) => s.metadata?.checkout_type !== "city_exclusivity");
      if (checkoutType === "subscription" && planSubs.length > 0) {
        return new Response(
          JSON.stringify({
            error: "You already have an active subscription. Manage it from your dashboard.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (checkoutType === "city_exclusivity") {
      const label = String(city ?? "").trim().slice(0, 100);
      const cityKey = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!cityKey) throw new Error("Enter a city and state");
      const { data: profile } = await supabaseClient.from("profiles").select("subscription_tier").eq("user_id", user.id).maybeSingle();
      if (!profile?.subscription_tier || profile.subscription_tier === "free") {
        return new Response(JSON.stringify({ error: "City exclusivity is available on paid plans. Upgrade first." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: held } = await supabaseClient.from("city_exclusivities").select("user_id").eq("city_key", cityKey).in("status", ["active", "past_due"]).maybeSingle();
      if (held) {
        return new Response(JSON.stringify({ error: held.user_id === user.id ? "You already hold this city." : "This city is already reserved." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: addon } = await supabaseClient.from("pricing_settings").select("label, price_cents").eq("setting_key", "addon_city_exclusivity").eq("is_active", true).single();
      if (!addon?.price_cents) throw new Error("City exclusivity is unavailable");
      const meta = { supabase_user_id: user.id, checkout_type: "city_exclusivity", city_key: cityKey, city_label: label };
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price_data: { currency: "usd", unit_amount: addon.price_cents, recurring: { interval: "month" }, product_data: { name: `${addon.label}: ${label}` } }, quantity: 1 }],
        mode: "subscription",
        success_url: `${req.headers.get("origin")}/checkout/success`,
        cancel_url: `${req.headers.get("origin")}/checkout/cancel`,
        subscription_data: { metadata: meta },
        metadata: meta,
      });
      await supabaseClient.from("city_exclusivities").insert({ user_id: user.id, city_key: cityKey, city_label: label, status: "pending", stripe_session_id: session.id });
      return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    if (checkoutType === "credit_addon") {
      if (addonKey !== "addon_500") throw new Error("Invalid credit add-on");
      const { data: addon } = await supabaseClient.from("pricing_settings")
        .select("label, credits, price_cents").eq("setting_key", addonKey).eq("is_active", true).single();
      if (!addon?.credits || !addon.price_cents) throw new Error("Credit add-on is unavailable");
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price_data: { currency: "usd", unit_amount: addon.price_cents, product_data: { name: addon.label } }, quantity: 1 }],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/checkout/success`,
        cancel_url: `${req.headers.get("origin")}/checkout/cancel`,
        metadata: { supabase_user_id: user.id, checkout_type: "credit_addon", addon_key: addonKey, credits: String(addon.credits) },
      });
      await supabaseClient.from("credit_purchases").insert({
        user_id: user.id, stripe_session_id: session.id, credits_purchased: addon.credits,
        amount_paid_cents: addon.price_cents, status: "pending",
      });
      return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: Math.max(1, Math.min(seats, 100)), // Clamp 1–100
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/checkout/success`,
      cancel_url: `${req.headers.get("origin")}/checkout/cancel`,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          user_email: user.email,
        },
      },
      metadata: {
        supabase_user_id: user.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
