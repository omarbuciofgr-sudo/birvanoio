import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
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

    const { firstName, lastName, email, message } = validation.data;

    console.log(`Contact form submission from ${firstName} ${lastName} <${email}>`);

    // Send notification email to Brivano
    const notificationEmail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Brivano Contact Form <${fromEmail}>`,
        to: ["info@brivano.io"],
        subject: `New Lead Request from ${firstName} ${lastName}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Niche & Target Location:</strong></p>
          <p>${message.replace(/\n/g, "<br>")}</p>
          <hr>
          <p><em>Submitted via Brivano website contact form</em></p>
        `,
      }),
    });

    const notificationData = await notificationEmail.json();

    if (!notificationEmail.ok) {
      console.error("Failed to send notification email:", notificationData);
      throw new Error("Failed to send notification");
    }

    console.log("Notification email sent:", notificationData.id);

    // Send confirmation email to the user
    const confirmationEmail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Brivano <${fromEmail}>`,
        to: [email],
        subject: "We received your request - Sample leads coming soon!",
        html: `
          <h1>Thanks for reaching out, ${firstName}!</h1>
          <p>We've received your request for sample leads. Our team will review your niche and target location, and we'll send you 10 sample leads within 24 hours.</p>
          <h3>What you requested:</h3>
          <p><em>${message.replace(/\n/g, "<br>")}</em></p>
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
