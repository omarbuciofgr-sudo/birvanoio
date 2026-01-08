import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recordingUrl } = await req.json();

    if (!recordingUrl) {
      return new Response(
        JSON.stringify({ error: "Recording URL is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch the recording from Twilio with authentication
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const response = await fetch(recordingUrl, {
      headers: {
        "Authorization": `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch recording:", response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch recording" }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the audio data
    const audioData = await response.arrayBuffer();

    // Return the audio with proper headers
    return new Response(audioData, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioData.byteLength.toString(),
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in get-recording:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch recording" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
