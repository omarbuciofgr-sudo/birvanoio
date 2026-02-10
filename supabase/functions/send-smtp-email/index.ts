import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emailSchema = z.object({
  to: z.string().email().max(255),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  leadId: z.string().uuid().optional(),
  emailAccountId: z.string().uuid().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rawInput = await req.json();
    const validation = emailSchema.safeParse(rawInput);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: validation.error.errors.map(e => e.message) }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { to, subject, body, leadId, emailAccountId } = validation.data;

    // Verify lead ownership
    if (leadId) {
      const { data: lead } = await supabase.from("leads").select("client_id").eq("id", leadId).single();
      if (!lead || lead.client_id !== user.id) {
        return new Response(JSON.stringify({ error: "Lead not found or unauthorized" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Get user's SMTP email account
    let query = supabase.from("user_email_accounts").select("*").eq("user_id", user.id);
    if (emailAccountId) {
      query = query.eq("id", emailAccountId);
    } else {
      query = query.eq("is_default", true);
    }
    const { data: emailAccount } = await query.single();

    if (!emailAccount) {
      // Fallback to Resend if no SMTP account configured
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        return new Response(JSON.stringify({ error: "No email account configured. Please add one in Settings." }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Use Resend fallback
      const { data: profile } = await supabase.from("profiles")
        .select("sender_email, first_name, last_name, company_name")
        .eq("user_id", user.id).single();

      const senderEmail = profile?.sender_email || "onboarding@resend.dev";
      const senderName = profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "CRM";

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${senderName} <${senderEmail}>`, to: [to], subject, html: body.replace(/\n/g, "<br>") }),
      });

      const emailData = await emailResponse.json();
      if (!emailResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to send email" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (leadId) {
        await supabase.from("conversation_logs").insert({
          lead_id: leadId, client_id: user.id, type: "email", direction: "outbound", subject, content: body,
        });
      }

      return new Response(JSON.stringify({ success: true, id: emailData.id, via: "resend" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Send via SMTP
    const client = new SmtpClient();
    const connectConfig: any = {
      hostname: emailAccount.smtp_host,
      port: emailAccount.smtp_port,
      username: emailAccount.smtp_username,
      password: emailAccount.smtp_password_encrypted,
    };

    if (emailAccount.use_tls) {
      await client.connectTLS(connectConfig);
    } else {
      await client.connect(connectConfig);
    }

    await client.send({
      from: emailAccount.email_address,
      to: to,
      subject: subject,
      content: "text/html",
      html: body.replace(/\n/g, "<br>"),
    });

    await client.close();

    // Update last used
    await supabase.from("user_email_accounts").update({ last_used_at: new Date().toISOString() }).eq("id", emailAccount.id);

    // Log conversation
    if (leadId) {
      await supabase.from("conversation_logs").insert({
        lead_id: leadId, client_id: user.id, type: "email", direction: "outbound", subject, content: body,
      });
    }

    console.log(`Email sent via SMTP (${emailAccount.smtp_host}) to ${to}`);

    return new Response(JSON.stringify({ success: true, via: "smtp", from: emailAccount.email_address }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("SMTP send error:", error);
    return new Response(JSON.stringify({ error: "Failed to send email. Check your SMTP settings." }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
