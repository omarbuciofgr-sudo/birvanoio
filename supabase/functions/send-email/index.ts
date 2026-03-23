import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const emailSchema = z.object({
  to: z.string().email("Invalid email address").max(255, "Email too long"),
  subject: z.string()
    .min(1, "Subject is required")
    .max(200, "Subject too long")
    .regex(/^[^\n\r]*$/, "Subject cannot contain newlines"),
  body: z.string()
    .min(1, "Body is required")
    .max(10000, "Body too long"),
  leadId: z.string().uuid("Invalid lead ID").optional(),
});

// Sanitize error messages to avoid leaking internal details
const sanitizeError = (error: any, operation: string): { message: string; status: number } => {
  console.error(`Error in ${operation}:`, error);

  const errorMessage = error?.message?.toLowerCase() || "";

  if (errorMessage.includes("not configured") || errorMessage.includes("api key")) {
    return { message: "Service temporarily unavailable", status: 503 };
  }

  if (errorMessage.includes("invalid") || errorMessage.includes("validation")) {
    return { message: "Invalid request parameters", status: 400 };
  }

  if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
    return { message: "Too many requests, please try again later", status: 429 };
  }

  return { message: `Failed to ${operation}. Please try again or contact support.`, status: 500 };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const defaultSenderEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    if (!resendApiKey) {
      throw new Error("Resend API key not configured");
    }

    // Parse and validate input
    const rawInput = await req.json();
    const validation = emailSchema.safeParse(rawInput);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.errors.map(e => e.message) }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { to, subject, body, leadId } = validation.data;

    // Require authentication - no anonymous email sending allowed
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const clientId = user.id;
    let senderEmail = defaultSenderEmail;
    let senderName = "CRM";
    
    // Fetch client's custom sender email and name if configured
    const { data: profile } = await supabase
      .from("profiles")
      .select("sender_email, first_name, last_name, company_name")
      .eq("user_id", user.id)
      .single();
    
    if (profile?.sender_email) {
      senderEmail = profile.sender_email;
      // Use company name or full name as sender name
      if (profile.company_name) {
        senderName = profile.company_name;
      } else if (profile.first_name || profile.last_name) {
        senderName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
      }
      console.log(`Using client's custom sender email: ${senderEmail}`);
    }

    // Verify lead ownership before sending email
    if (leadId) {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("client_id")
        .eq("id", leadId)
        .single();

      if (leadError || !lead) {
        return new Response(
          JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (lead.client_id !== clientId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Lead does not belong to user" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log(`Sending email to ${to} from ${senderName} <${senderEmail}> with subject: ${subject}`);

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [to],
        subject: subject,
        html: body.replace(/\n/g, "<br>"),
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend error:", emailData);
      // Return generic error instead of exposing API details
      return new Response(
        JSON.stringify({ error: "Failed to send email. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", emailData.id);

    // Log the conversation
    if (leadId) {
      const { error: logError } = await supabase.from("conversation_logs").insert({
        lead_id: leadId,
        client_id: clientId,
        type: "email",
        direction: "outbound",
        subject: subject,
        content: body,
      });

      if (logError) {
        console.error("Error logging conversation:", logError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: emailData.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    const { message, status } = sanitizeError(error, "send email");
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
