import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { chargeCredits, serviceClient } from "../_shared/billing.ts";
import { assertEmailNotSuppressed } from "../_shared/campaignCompliance.ts";

const Body = z.object({
  reportId: z.string().uuid(),
  address: z.string().min(3).max(300),
  mode: z.enum(["download", "email"]),
  leadId: z.string().uuid().optional(),
  pdfBase64: z.string().max(7_000_000).optional(),
  subject: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in." }, 401);
  const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims } = await uc.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return json({ error: "Please sign in." }, 401);

  let parsed;
  try { parsed = Body.safeParse(await req.json()); } catch { return json({ error: "Invalid request." }, 400); }
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  const { reportId, address, mode, leadId, pdfBase64, subject, message } = parsed.data;
  const db = serviceClient();

  const { data: existing } = await db.from("market_reports").select("user_id").eq("id", reportId).maybeSingle();
  if (existing && existing.user_id !== userId) return json({ error: "Invalid request." }, 400);
  const alreadyCharged = !!existing;

  const charge = async () => {
    if (alreadyCharged) return { ok: true, spent: 0 };
    const r = await chargeCredits(userId, "action_market_report", 1, `report:${reportId}`);
    if (!r.success) return { ok: false, spent: 0 };
    await db.from("market_reports").insert({ id: reportId, user_id: userId, address });
    return { ok: true, spent: 3 };
  };

  try {
    if (mode === "download") {
      const c = await charge();
      if (!c.ok) return json({ error: "You need 3 credits to create this report.", code: "credits" }, 402);
      return json({ success: true, spent: c.spent });
    }

    // Email: only to a saved lead the user owns, honoring opt-outs.
    if (!leadId || !pdfBase64) return json({ error: "Save this owner to My Leads with an email to send the report." }, 400);
    const { data: lead } = await uc.from("leads").select("id, email, do_not_contact").eq("id", leadId).maybeSingle();
    if (!lead?.email) return json({ error: "This owner has no email saved yet." }, 400);
    if (lead.do_not_contact) return json({ error: "This owner asked not to be contacted." }, 400);
    try { await assertEmailNotSuppressed(db, userId, lead.email); } catch { return json({ error: "This owner has unsubscribed from your emails." }, 400); }

    // Make sure credits are available before sending.
    if (!alreadyCharged) {
      const { data: bal } = await db.rpc("consume_action_credits_for_user", { p_user_id: userId, p_action_key: "action_market_report", p_units: 0, p_reference_id: null }).then((r) => r, () => ({ data: null }));
      void bal;
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Email isn't available right now." }, 503);
    const { data: profile } = await db.from("profiles").select("first_name, last_name, brokerage, company_name, sender_email").eq("user_id", userId).maybeSingle();
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Your agent";
    const fromEmail = profile?.sender_email || Deno.env.get("RESEND_FROM_EMAIL") || "reports@brivano.io";
    const subj = subject?.trim() || `Market report for ${address}`;
    const text = message?.trim() || `Hi, I put together a short market report for ${address}. It's attached as a PDF.`;

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${name} <${fromEmail}>`,
        to: [lead.email],
        subject: subj,
        html: `<div style="font-family:Arial,sans-serif">${esc(text).replace(/\n/g, "<br>")}<br><br>${esc(name)}${profile?.brokerage || profile?.company_name ? `<br>${esc(profile.brokerage || profile.company_name!)}` : ""}</div>`,
        attachments: [{ filename: "market-report.pdf", content: pdfBase64 }],
      }),
    });
    if (!send.ok) {
      console.error("report email failed", send.status, (await send.text()).slice(0, 300));
      return json({ error: "We couldn't send the email. Please try again." }, 502);
    }
    const c = await charge();
    await db.from("conversation_logs").insert({ lead_id: leadId, client_id: userId, type: "email", direction: "outbound", subject: subj, content: `${text}\n\n[Market report PDF attached]` });
    return json({ success: true, spent: c.spent, charged: c.ok });
  } catch (e) {
    console.error("market-report error", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
