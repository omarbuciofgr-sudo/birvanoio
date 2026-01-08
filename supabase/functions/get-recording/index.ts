import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT and get user claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub;

    const { recordingUrl } = await req.json();

    if (!recordingUrl) {
      return new Response(
        JSON.stringify({ error: "Recording URL is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the user has access to this recording
    // Check if the recording belongs to a conversation log owned by the user or if user is admin
    const { data: log, error: logError } = await supabase
      .from("conversation_logs")
      .select("client_id")
      .eq("recording_url", recordingUrl)
      .single();

    if (logError || !log) {
      console.error("Recording not found or access denied:", logError);
      return new Response(
        JSON.stringify({ error: "Recording not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user owns the recording or is an admin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (log.client_id !== userId && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to access this recording" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
    const authHeaderTwilio = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const response = await fetch(recordingUrl, {
      headers: {
        "Authorization": `Basic ${authHeaderTwilio}`,
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
