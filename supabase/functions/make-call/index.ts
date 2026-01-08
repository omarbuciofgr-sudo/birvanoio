import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// E.164 phone number validation
const e164Regex = /^\+[1-9]\d{1,14}$/;

// Input validation schema
const callSchema = z.object({
  to: z.string()
    .min(1, "Phone number is required")
    .regex(e164Regex, "Phone number must be in E.164 format (example: +15551234567)"),
  leadId: z.string().uuid("Invalid lead ID").optional(),
});

// Sanitize error messages to avoid leaking internal details
const sanitizeError = (error: any, operation: string): { message: string; status: number } => {
  console.error(`Error in ${operation}:`, error);

  const errorMessage = error?.message?.toLowerCase() || "";

  if (errorMessage.includes("not configured") || errorMessage.includes("credentials")) {
    return { message: "Service temporarily unavailable", status: 503 };
  }

  if (errorMessage.includes("invalid") || errorMessage.includes("e.164")) {
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
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const defaultTwilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !defaultTwilioPhone) {
      throw new Error("Twilio credentials not configured");
    }

    // Parse and validate input
    const rawInput = await req.json();
    const validation = callSchema.safeParse(rawInput);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.errors.map(e => e.message) }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { to, leadId } = validation.data;

    // Get the user from the authorization header
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let clientId = "system";
    let twilioPhone = defaultTwilioPhone;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        clientId = user.id;
        
        // Fetch client's custom Twilio phone number if configured
        const { data: profile } = await supabase
          .from("profiles")
          .select("twilio_phone_number")
          .eq("user_id", user.id)
          .single();
        
        if (profile?.twilio_phone_number && e164Regex.test(profile.twilio_phone_number)) {
          twilioPhone = profile.twilio_phone_number;
          console.log(`Using client's custom Twilio number: ${twilioPhone}`);
        }
      }
    }

    if (!e164Regex.test(twilioPhone)) {
      console.error("Twilio phone number is not in E.164 format");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify lead ownership before initiating call
    if (leadId && clientId !== "system") {
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

    console.log(`Initiating call to ${to} from ${twilioPhone}`);

    // Initiate call via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("From", twilioPhone);
    // Enable call recording
    formData.append("Record", "true");
    formData.append("RecordingStatusCallback", `${Deno.env.get("SUPABASE_URL")}/functions/v1/recording-callback`);
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
      // Return generic error instead of exposing Twilio API details
      return new Response(
        JSON.stringify({ error: "Failed to initiate call. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Call initiated successfully:", twilioData.sid);

    // Log the conversation with call_sid for recording callback matching
    if (leadId) {
      const { error: logError } = await supabase.from("conversation_logs").insert({
        lead_id: leadId,
        client_id: clientId,
        type: "call",
        direction: "outbound",
        content: "Call initiated via Twilio",
        call_sid: twilioData.sid,
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
    const { message, status } = sanitizeError(error, "initiate call");
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
