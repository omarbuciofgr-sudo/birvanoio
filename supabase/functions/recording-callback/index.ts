import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize error messages to avoid leaking internal details
const sanitizeError = (error: any, operation: string): { message: string; status: number } => {
  console.error(`Error in ${operation}:`, error);
  return { message: `Failed to ${operation}. Please try again or contact support.`, status: 500 };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Twilio sends form data
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const recordingSid = formData.get("RecordingSid") as string;
    const recordingUrl = formData.get("RecordingUrl") as string;
    const recordingDuration = formData.get("RecordingDuration") as string;
    const recordingStatus = formData.get("RecordingStatus") as string;

    console.log("Recording callback received:", {
      callSid,
      recordingSid,
      recordingUrl,
      recordingDuration,
      recordingStatus,
    });

    if (recordingStatus === "completed" && recordingUrl && callSid) {
      const fullRecordingUrl = `${recordingUrl}.mp3`;
      
      console.log("Recording completed:", {
        sid: recordingSid,
        url: fullRecordingUrl,
        duration: recordingDuration,
      });

      // Update the conversation log with the recording URL
      const { data, error: updateError } = await supabase
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
