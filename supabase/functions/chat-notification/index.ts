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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, visitorEmail, sessionId }: ChatNotificationRequest = await req.json();

    const notifyEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const emailResponse = await resend.emails.send({
      from: `Brivano Chat <${notifyEmail}>`,
      to: ["support@brivano.com"], // Update this to your actual support email
      subject: `New Chat Message from ${visitorEmail || 'Anonymous Visitor'}`,
      html: `
        <h2>New Chat Widget Message</h2>
        <p><strong>Session ID:</strong> ${sessionId}</p>
        <p><strong>Visitor Email:</strong> ${visitorEmail || 'Not provided'}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
