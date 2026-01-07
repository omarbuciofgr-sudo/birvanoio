import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallRequest {
  to: string;
  leadId: string;
}

const e164Regex = /^\+[1-9]\d{1,14}$/;
const isE164 = (value: string) => e164Regex.test(value);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      throw new Error("Twilio credentials not configured");
    }

    const { to, leadId }: CallRequest = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Missing required field: to" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!isE164(to)) {
      return new Response(
        JSON.stringify({ error: "Phone number must be in E.164 format (example: +15551234567)." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!isE164(twilioPhone)) {
      return new Response(
        JSON.stringify({ error: "Configured Twilio phone number must be in E.164 format." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the user from the authorization header
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let clientId = "system";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        clientId = user.id;
      }
    }

    console.log(`Initiating call to ${to} from ${twilioPhone}`);

    // Initiate call via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("From", twilioPhone);
    // TwiML that says a message - you can customize this
    formData.append("Twiml", `<Response><Say>Hello, this is a call from your CRM. Please hold while we connect you.</Say><Pause length="60"/></Response>`);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      const status = typeof twilioData?.status === "number" ? twilioData.status : 500;
      return new Response(
        JSON.stringify({ error: twilioData.message || "Failed to initiate call", code: twilioData.code }),
        { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Call initiated successfully:", twilioData.sid);

    // Log the conversation
    if (leadId) {
      const { error: logError } = await supabase.from("conversation_logs").insert({
        lead_id: leadId,
        client_id: clientId,
        type: "call",
        direction: "outbound",
        content: "Call initiated via Twilio",
      });

      if (logError) {
        console.error("Error logging conversation:", logError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sid: twilioData.sid }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in make-call:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
