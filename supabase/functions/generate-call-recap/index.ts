import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const recapSchema = z.object({
  recordingUrl: z.string().url("Invalid recording URL").optional().or(z.literal("")),
  leadName: z.string().max(100, "Lead name too long").optional().default(""),
  businessName: z.string().max(200, "Business name too long").optional().default(""),
});

// Sanitize error messages to avoid leaking internal details
const sanitizeError = (error: any, operation: string): { message: string; status: number } => {
  console.error(`Error in ${operation}:`, error);

  const errorMessage = error?.message?.toLowerCase() || "";

  if (errorMessage.includes("not configured") || errorMessage.includes("api key")) {
    return { message: "Service temporarily unavailable", status: 503 };
  }

  if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
    return { message: "Too many requests, please try again later", status: 429 };
  }

  if (errorMessage.includes("credits") || errorMessage.includes("exhausted")) {
    return { message: "Service credits exhausted. Please contact support.", status: 402 };
  }

  return { message: `Failed to ${operation}. Please try again or contact support.`, status: 500 };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Parse and validate input
    const rawInput = await req.json();
    const validation = recapSchema.safeParse(rawInput);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.errors.map(e => e.message) }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { recordingUrl, leadName, businessName } = validation.data;

    let transcriptionText = "";

    // Only fetch transcription if we have a valid recording URL
    if (recordingUrl && !recordingUrl.includes("placeholder")) {
      console.log("Fetching transcription for recording:", recordingUrl);

      // Fetch the transcription from Twilio (they auto-generate it)
      const transcriptionUrl = `${recordingUrl}/Transcriptions.json`;
      const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      
      try {
        const transcriptionResponse = await fetch(transcriptionUrl, {
          headers: {
            "Authorization": `Basic ${credentials}`,
          },
        });
        
        if (transcriptionResponse.ok) {
          const transcriptionData = await transcriptionResponse.json();
          if (transcriptionData.transcriptions?.length > 0) {
            // Fetch the actual transcription text
            const transcriptDetailUrl = transcriptionData.transcriptions[0].uri.replace('.json', '/Transcriptions.json');
            const detailResponse = await fetch(`https://api.twilio.com${transcriptDetailUrl}`, {
              headers: { "Authorization": `Basic ${credentials}` },
            });
            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              transcriptionText = detail.transcription_text || "";
            }
          }
        }
      } catch (e) {
        console.log("Could not fetch Twilio transcription:", e);
      }
    } else {
      console.log("No recording URL provided, generating generic recap");
    }

    // If no transcription available, use a placeholder for demo
    if (!transcriptionText) {
      transcriptionText = "Call recording transcription not available. Please provide a summary based on the context that this was a business call.";
    }

    console.log("Generating recap with AI...");

    // Use Lovable AI to generate the recap
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional business assistant. Generate concise, professional follow-up communications based on call transcriptions. 
            
Your output should be JSON with two fields:
- emailContent: A professional follow-up email (include subject line at start)
- smsContent: A brief SMS message (max 160 chars)

Keep the tone professional but friendly. Focus on key takeaways and next steps.`
          },
          {
            role: "user",
            content: `Generate a follow-up email and SMS for a call with ${leadName || 'the contact'} from ${businessName || 'the company'}.

Call transcription/notes:
${transcriptionText}

Please create:
1. A professional follow-up email summarizing the call and any next steps
2. A brief SMS message (under 160 characters) thanking them for their time`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests, please try again later" }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service credits exhausted. Please contact support." }),
          { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", errorText);
      throw new Error("Failed to generate recap");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response:", content);

    // Parse the JSON response from AI
    let emailContent = "";
    let smsContent = "";

    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        emailContent = parsed.emailContent || "";
        smsContent = parsed.smsContent || "";
      }
    } catch (e) {
      // If JSON parsing fails, use the raw content
      console.log("Could not parse JSON, using raw content");
      emailContent = content;
      smsContent = `Thank you for your time on our call. Looking forward to next steps!`;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailContent, 
        smsContent,
        transcriptionAvailable: transcriptionText !== "Call recording transcription not available. Please provide a summary based on the context that this was a business call."
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    const { message, status } = sanitizeError(error, "generate recap");
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
