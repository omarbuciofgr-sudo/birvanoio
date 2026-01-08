import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize error messages to avoid leaking internal details
const sanitizeError = (error: any, operation: string): { message: string; status: number } => {
  console.error(`Error in ${operation}:`, error);
  return { message: `Failed to ${operation}. Please try again or contact support.`, status: 500 };
};

// Validate Twilio signature to ensure request authenticity
const validateTwilioSignature = async (
  signature: string,
  url: string,
  params: Record<string, string>,
  authToken: string
): Promise<boolean> => {
  // Sort keys alphabetically
  const sortedKeys = Object.keys(params).sort();
  
  // Build string: URL + sorted params concatenated
  let data = url;
  sortedKeys.forEach(key => {
    data += key + params[key];
  });
  
  // Calculate HMAC-SHA1 using Web Crypto API
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expectedSignature = encodeBase64(signatureBytes);
  
  return signature === expectedSignature;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Twilio signature
    const twilioSignature = req.headers.get("X-Twilio-Signature");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!twilioSignature) {
      console.warn("Missing Twilio signature in recording callback");
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!twilioAuthToken) {
      console.error("TWILIO_AUTH_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse form data for signature validation
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Get the full URL for signature validation
    // Twilio uses the actual URL they called for signature computation
    const url = req.url;

    if (!await validateTwilioSignature(twilioSignature, url, params, twilioAuthToken)) {
      console.warn("Invalid Twilio signature in recording callback");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract validated Twilio form data
    const callSid = params["CallSid"];
    const recordingSid = params["RecordingSid"];
    const recordingUrl = params["RecordingUrl"];
    const recordingDuration = params["RecordingDuration"];
    const recordingStatus = params["RecordingStatus"];

    console.log("Recording callback received (validated):", {
      callSid,
      recordingSid,
      recordingUrl,
      recordingDuration,
      recordingStatus,
    });

    if (recordingStatus === "completed" && recordingUrl && callSid) {
      // Validate recording URL format (must be from Twilio)
      if (!recordingUrl.startsWith("https://api.twilio.com/")) {
        console.warn("Invalid recording URL format:", recordingUrl);
        return new Response(
          JSON.stringify({ error: "Invalid recording URL" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const fullRecordingUrl = `${recordingUrl}.mp3`;
      
      console.log("Recording completed:", {
        sid: recordingSid,
        url: fullRecordingUrl,
        duration: recordingDuration,
      });

      // Update the conversation log with the recording URL
      const { error: updateError } = await supabase
        .from("conversation_logs")
        .update({ 
          recording_url: fullRecordingUrl,
          duration_seconds: parseInt(recordingDuration) || null,
        })
        .eq("call_sid", callSid);

      if (updateError) {
        console.error("Error updating conversation log with recording:", updateError);
      } else {
        console.log("Successfully updated conversation log with recording URL");
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    const { message, status } = sanitizeError(error, "process recording callback");
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});