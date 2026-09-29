import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Returns the total the signed-in user has actually paid (Stripe paid invoices), in dollars.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.getUser(auth.slice(7));
    if (error || !data.user?.email) return json({ error: "Unauthorized" }, 401);

    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ totalPaid: 0 });
    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: data.user.email, limit: 10 });
    let cents = 0;
    for (const c of customers.data) {
      for await (const inv of stripe.invoices.list({ customer: c.id, status: "paid", limit: 100 })) {
        cents += inv.amount_paid ?? 0;
      }
    }
    return json({ totalPaid: cents / 100 });
  } catch (e) {
    console.error("[billing-spend]", e);
    return json({ error: "Could not load billing history" }, 500);
  }
});
