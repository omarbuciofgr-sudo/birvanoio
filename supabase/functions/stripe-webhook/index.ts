import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

// Map Stripe product IDs to plan tiers
const TIER_MAP: Record<string, string> = {
  "prod_TkqoACAHdNPHsv": "starter",
  "prod_TkqpMe4AqSDUmv": "growth",
  "prod_TkqtBClmSUlwQu": "scale",
  "prod_TkqyoaMo9XVlQG": "starter",
  "prod_TkqzsHd16kE95P": "growth",
  "prod_Tkr1MJspbuRMt9": "scale",
};

// Credits per seat per month by tier
const CREDITS_PER_SEAT: Record<string, number> = {
  starter: 500,
  growth: 2000,
  scale: 10000,
  enterprise: 999999,
};

const log = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

async function findOrCreateWorkspaceForCustomer(
  customerId: string,
  subscription: Stripe.Subscription,
  customerEmail: string
) {
  const item = subscription.items.data[0];
  const productId = item.price.product as string;
  const tier = TIER_MAP[productId] || "starter";
  const seats = item.quantity || 1;

  // Check if workspace already exists for this Stripe customer
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (existing) {
    log("Workspace already exists for customer", { workspaceId: existing.id });
    return existing.id;
  }

  // Find the user by email
  const { data: userData } = await supabase.auth.admin.listUsers();
  const user = userData?.users?.find(
    (u) => u.email?.toLowerCase() === customerEmail.toLowerCase()
  );

  if (!user) {
    log("ERROR: No user found for email", { customerEmail });
    throw new Error(`No user found for email: ${customerEmail}`);
  }

  // Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({
      name: `${customerEmail.split("@")[0]}'s Workspace`,
      plan_tier: tier,
      seats_purchased: seats,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_subscription_item_id: item.id,
      stripe_price_id: item.price.id,
      billing_email: customerEmail,
      created_by: user.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (wsError) {
    log("ERROR creating workspace", { error: wsError });
    throw wsError;
  }

  log("Workspace created", { workspaceId: workspace.id, tier, seats });

  // Provision initial monthly credits for the owner
  const now = new Date();
  const periodEnd = new Date(subscription.current_period_end * 1000);
  await supabase.from("user_monthly_credits").upsert(
    {
      user_id: user.id,
      workspace_id: workspace.id,
      period_start: now.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      monthly_allowance: CREDITS_PER_SEAT[tier] || 500,
      credits_used: 0,
      topup_credits: 0,
    },
    { onConflict: "user_id,workspace_id,period_start" }
  );

  return workspace.id;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  log("checkout.session.completed", { sessionId: session.id });

  if (session.mode !== "subscription") {
    log("Skipping non-subscription checkout");
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    log("ERROR: No customer email in session");
    return;
  }

  // Fetch the full subscription to get item details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await findOrCreateWorkspaceForCustomer(customerId, subscription, customerEmail);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  log("customer.subscription.updated", { subId: subscription.id });

  const customerId = subscription.customer as string;
  const item = subscription.items.data[0];
  const productId = item.price.product as string;
  const tier = TIER_MAP[productId] || "starter";
  const seats = item.quantity || 1;

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .update({
      plan_tier: tier,
      seats_purchased: seats,
      stripe_subscription_item_id: item.id,
      stripe_price_id: item.price.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId)
    .select("id")
    .maybeSingle();

  if (error) {
    log("ERROR updating workspace", { error });
    return;
  }

  if (!workspace) {
    log("No workspace found for customer, attempting creation", { customerId });
    const customer = await stripe.customers.retrieve(customerId);
    if ("email" in customer && customer.email) {
      await findOrCreateWorkspaceForCustomer(customerId, subscription, customer.email);
    }
    return;
  }

  log("Workspace updated", { workspaceId: workspace.id, tier, seats });

  // Update monthly credit allowances for all workspace members
  const periodStart = new Date(subscription.current_period_start * 1000)
    .toISOString()
    .slice(0, 10);
  const periodEnd = new Date(subscription.current_period_end * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: members } = await supabase
    .from("workspace_memberships")
    .select("user_id, role")
    .eq("workspace_id", workspace.id);

  if (members) {
    for (const member of members) {
      // Check if viewer consumes credits
      const { data: settings } = await supabase
        .from("workspace_settings")
        .select("viewer_consumes_seat")
        .eq("workspace_id", workspace.id)
        .maybeSingle();

      const viewerGetsCredits = settings?.viewer_consumes_seat !== false;
      if (member.role === "viewer" && !viewerGetsCredits) continue;

      await supabase.from("user_monthly_credits").upsert(
        {
          user_id: member.user_id,
          workspace_id: workspace.id,
          period_start: periodStart,
          period_end: periodEnd,
          monthly_allowance: CREDITS_PER_SEAT[tier] || 500,
          credits_used: 0,
          topup_credits: 0,
        },
        { onConflict: "user_id,workspace_id,period_start" }
      );
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  log("customer.subscription.deleted", { subId: subscription.id });

  const customerId = subscription.customer as string;

  const { error } = await supabase
    .from("workspaces")
    .update({
      plan_tier: "free",
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
      stripe_price_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    log("ERROR downgrading workspace", { error });
  } else {
    log("Workspace downgraded to free", { customerId });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
      },
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature || !WEBHOOK_SECRET) {
      log("Missing signature or webhook secret");
      return new Response(JSON.stringify({ error: "Missing signature" }), { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
    } catch (err) {
      log("Webhook signature verification failed", { error: String(err) });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    log("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid": {
        // On invoice.paid, refresh the subscription period on workspace
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await handleSubscriptionUpdated(sub);
        }
        break;
      }
      default:
        log("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log("ERROR", { message: String(error) });
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
