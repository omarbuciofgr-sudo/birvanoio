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

// ─── Helpers ────────────────────────────────────────────────────────

function extractSubscriptionFields(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const productId = item.price.product as string;
  const tier = TIER_MAP[productId] || "starter";
  const seats = item.quantity || 1;
  return { item, productId, tier, seats };
}

function stripeBillingStatus(status: string): string {
  // Map Stripe subscription statuses to our billing_status enum
  switch (status) {
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled":
    case "unpaid": return "canceled";
    case "trialing": return "trialing";
    case "incomplete":
    case "incomplete_expired": return "incomplete";
    default: return "active";
  }
}

async function findUserByEmail(email: string) {
  const { data: userData } = await supabase.auth.admin.listUsers();
  return userData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
}

// ─── Workspace creation ─────────────────────────────────────────────

async function findOrCreateWorkspaceForCustomer(
  customerId: string,
  subscription: Stripe.Subscription,
  customerEmail: string
) {
  const { item, tier, seats } = extractSubscriptionFields(subscription);

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

  const user = await findUserByEmail(customerEmail);
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
      billing_status: stripeBillingStatus(subscription.status),
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
  return workspace.id;
}

// ─── Credit allocation ──────────────────────────────────────────────

async function allocateMonthlyCredits(
  workspaceId: string,
  tier: string,
  seats: number,
  periodStart: string,
  periodEnd: string,
  invoiceId?: string
) {
  const creditsPerSeat = CREDITS_PER_SEAT[tier] || 500;

  // Get all active workspace members (excluding viewers unless configured)
  const { data: members } = await supabase
    .from("workspace_memberships")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);

  if (!members?.length) {
    log("No members to allocate credits for", { workspaceId });
    return;
  }

  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("viewer_consumes_seat")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const viewerGetsCredits = settings?.viewer_consumes_seat !== false;

  for (const member of members) {
    if (member.role === "viewer" && !viewerGetsCredits) continue;

    // Reset credits for the new period
    await supabase.from("user_monthly_credits").upsert(
      {
        user_id: member.user_id,
        workspace_id: workspaceId,
        period_start: periodStart,
        period_end: periodEnd,
        monthly_allowance: creditsPerSeat,
        credits_used: 0,
        topup_credits: 0,
      },
      { onConflict: "user_id,workspace_id,period_start" }
    );

    // Record in credits ledger
    await supabase.from("credits_ledger").insert({
      workspace_id: workspaceId,
      user_id: member.user_id,
      event_type: "monthly_allocation",
      credits: creditsPerSeat,
      description: `Monthly ${tier} allocation (${creditsPerSeat} credits/seat)`,
      reference_id: invoiceId || null,
      period_start: periodStart,
      period_end: periodEnd,
    });
  }

  log("Credits allocated", { workspaceId, tier, members: members.length, creditsPerSeat });
}

// ─── Event handlers ─────────────────────────────────────────────────

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

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await findOrCreateWorkspaceForCustomer(customerId, subscription, customerEmail);
}

async function handleSubscriptionCreatedOrUpdated(subscription: Stripe.Subscription) {
  log("subscription.created/updated", { subId: subscription.id, status: subscription.status });

  const customerId = subscription.customer as string;
  const { item, tier, seats } = extractSubscriptionFields(subscription);
  const billingStatus = stripeBillingStatus(subscription.status);

  const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .update({
      plan_tier: tier,
      seats_purchased: seats,
      stripe_subscription_id: subscription.id,
      stripe_subscription_item_id: item.id,
      stripe_price_id: item.price.id,
      billing_status: billingStatus,
      current_period_start: periodStart,
      current_period_end: periodEnd,
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

  log("Workspace updated", { workspaceId: workspace.id, tier, seats, billingStatus });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  log("customer.subscription.deleted", { subId: subscription.id });

  const customerId = subscription.customer as string;

  const { error } = await supabase
    .from("workspaces")
    .update({
      plan_tier: "free",
      billing_status: "canceled",
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
      stripe_price_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    log("ERROR downgrading workspace", { error });
  } else {
    log("Workspace canceled", { customerId });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  log("invoice.paid", { invoiceId: invoice.id, subscription: invoice.subscription });

  if (!invoice.subscription) {
    log("Skipping non-subscription invoice");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const customerId = subscription.customer as string;
  const { tier, seats } = extractSubscriptionFields(subscription);

  // Update workspace to active
  const { data: workspace } = await supabase
    .from("workspaces")
    .update({
      billing_status: "active",
      plan_tier: tier,
      seats_purchased: seats,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId)
    .select("id")
    .maybeSingle();

  if (!workspace) {
    log("No workspace found for invoice.paid", { customerId });
    return;
  }

  // Allocate monthly credits for the new period
  const periodStart = new Date(subscription.current_period_start * 1000).toISOString().slice(0, 10);
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10);

  await allocateMonthlyCredits(workspace.id, tier, seats, periodStart, periodEnd, invoice.id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  log("invoice.payment_failed", { invoiceId: invoice.id, subscription: invoice.subscription });

  if (!invoice.subscription) return;

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const customerId = subscription.customer as string;

  const { error } = await supabase
    .from("workspaces")
    .update({
      billing_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    log("ERROR setting past_due", { error });
  } else {
    log("Workspace set to past_due", { customerId });
  }
}

// ─── Main handler ───────────────────────────────────────────────────

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

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

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
