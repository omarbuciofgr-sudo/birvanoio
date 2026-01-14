import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  message: z.string().trim().min(1, "Message is required").max(2000),
  recaptchaToken: z.string().min(1, "reCAPTCHA verification required"),
});

// HTML escape function to prevent XSS in emails
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Verify reCAPTCHA token with Google
async function verifyRecaptcha(token: string, secretKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();
    console.log("reCAPTCHA verification response:", { success: data.success, score: data.score });
    return data.success === true;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const rawFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const fromEmail = rawFromEmail.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const recaptchaSecretKey = Deno.env.get("RECAPTCHA_SECRET_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    if (!recaptchaSecretKey) {
      throw new Error("RECAPTCHA_SECRET_KEY not configured");
    }

    // Parse and validate input
    const rawInput = await req.json();
    const validation = contactSchema.safeParse(rawInput);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.errors.map(e => e.message) }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { firstName, lastName, email, message, recaptchaToken } = validation.data;

    // Verify reCAPTCHA
    const isValidRecaptcha = await verifyRecaptcha(recaptchaToken, recaptchaSecretKey);
    if (!isValidRecaptcha) {
      console.warn(`reCAPTCHA verification failed for ${email}`);
      return new Response(
        JSON.stringify({ error: "reCAPTCHA verification failed. Please try again." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Contact form submission from ${firstName} ${lastName} <${email}> (reCAPTCHA verified)`);

    // Save to database and get the ID
    let submissionId: string | null = null;
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: insertData, error: dbError } = await supabase
        .from("contact_submissions")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          message,
        })
        .select("id")
        .single();

      if (dbError) {
        console.error("Failed to save contact submission:", dbError);
      } else {
        submissionId = insertData?.id;
        console.log("Contact submission saved to database:", submissionId);
      }
    }

    // Build admin dashboard link
    const dashboardUrl = "https://brivano.io/dashboard/contacts";
    const submissionLink = submissionId 
      ? `${dashboardUrl}?id=${submissionId}` 
      : dashboardUrl;

    // Build a strict, valid "from" value (Resend requires: email@domain.com or Name <email@domain.com>)
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail);
    const fromHeader = isEmail ? `Brivano <${fromEmail}>` : "Brivano <onboarding@resend.dev>";

    // Send notification email to Brivano
    // IMPORTANT: Resend accounts in "testing" mode can only send to the account owner's email.
    // We should not fail the whole contact form submission if this notification fails.
    const notificationEmail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: ["info@brivano.io"],
        subject: `🔔 New Lead Request from ${escapeHtml(firstName)} ${escapeHtml(lastName)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="color: white; margin: 0;">New Contact Form Submission</h2>
            </div>
            <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 120px;"><strong>Name:</strong></td>
                  <td style="padding: 8px 0; color: #111827;">${escapeHtml(firstName)} ${escapeHtml(lastName)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Email:</strong></td>
                  <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #6366f1;">${escapeHtml(email)}</a></td>
                </tr>
              </table>
              
              <div style="margin-top: 16px; padding: 16px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><strong>Niche &amp; Target Location:</strong></p>
                <p style="margin: 0; color: #111827;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
              </div>
              
              <div style="margin-top: 24px; text-align: center;">
                <a href="${submissionLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                  View in Dashboard →
                </a>
              </div>
              
              <p style="margin-top: 24px; color: #9ca3af; font-size: 12px; text-align: center;">
                Submitted via Brivano website contact form
              </p>
            </div>
          </div>
        `,
      }),
    });

    // Don't assume a JSON body on errors
    let notificationData: any = null;
    try {
      notificationData = await notificationEmail.json();
    } catch {
      notificationData = null;
    }

    if (!notificationEmail.ok) {
      console.error("Failed to send notification email (non-blocking):", notificationData);
    } else {
      console.log("Notification email sent:", notificationData?.id);
    }

    // Send confirmation email to the user
    const confirmationEmail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [email],
        subject: "We received your request - Sample leads coming soon!",
        html: `
          <h1>Thanks for reaching out, ${escapeHtml(firstName)}!</h1>
          <p>We've received your request for sample leads. Our team will review your niche and target location, and we'll send you 10 sample leads within 24 hours.</p>
          <h3>What you requested:</h3>
          <p><em>${escapeHtml(message).replace(/\n/g, "<br>")}</em></p>
          <p>If you'd like to schedule a walkthrough, you can book a call here:</p>
          <p><a href="https://calendly.com/brivano-info-juke/30min">Schedule a 30-minute demo</a></p>
          <br>
          <p>Best regards,<br>The Brivano Team</p>
          <p><a href="https://brivano.io">brivano.io</a></p>
        `,
      }),
    });

    const confirmationData = await confirmationEmail.json();

    if (!confirmationEmail.ok) {
      console.error("Failed to send confirmation email:", confirmationData);
      // Don't throw - notification was sent, just log the error
    } else {
      console.log("Confirmation email sent:", confirmationData.id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in contact-form function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process your request. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
