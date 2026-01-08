import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatNotificationRequest {
  message: string;
  visitorEmail?: string;
  sessionId: string;
}

// HTML escape function to prevent XSS injection in emails
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, visitorEmail, sessionId }: ChatNotificationRequest = await req.json();

    // Validate and sanitize inputs
    if (!message || typeof message !== 'string' || message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Invalid message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid session ID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sanitize all user inputs before inserting into HTML
    const safeMessage = escapeHtml(message);
    const safeSessionId = escapeHtml(sessionId);
    const safeVisitorEmail = visitorEmail ? escapeHtml(visitorEmail) : 'Not provided';

    const notifyEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const emailResponse = await resend.emails.send({
      from: `Brivano Chat <${notifyEmail}>`,
      to: ["support@brivano.com"], // Update this to your actual support email
      subject: `New Chat Message from ${safeVisitorEmail}`,
      html: `
        <h2>New Chat Widget Message</h2>
        <p><strong>Session ID:</strong> ${safeSessionId}</p>
        <p><strong>Visitor Email:</strong> ${safeVisitorEmail}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Reply to this visitor through your Brivano dashboard.</p>
      `,
    });

    console.log("Chat notification sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending chat notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send notification" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
