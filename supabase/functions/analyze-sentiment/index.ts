import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { logId, content } = await req.json();

    if (!logId || !content) {
      return new Response(
        JSON.stringify({ error: "Log ID and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

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
            content: `You are a sentiment analysis expert for sales conversations. Analyze the provided text and determine the overall sentiment.

Consider:
- Interest level and buying signals
- Objections or concerns raised
- Tone and engagement
- Likelihood of conversion

Return ONLY a JSON object with:
- sentiment: "positive" | "neutral" | "negative"
- confidence: number between 0-100
- signals: brief explanation of key signals detected (max 30 words)`
          },
          {
            role: "user",
            content: `Analyze the sentiment of this sales conversation/note:\n\n${content}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw new Error("Failed to get AI response");
    }

    const aiData = await aiResponse.json();
    const responseContent = aiData.choices?.[0]?.message?.content || "";

    // Parse the sentiment
    let sentiment = "neutral";
    let confidence = 50;
    let signals = "";

    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (["positive", "neutral", "negative"].includes(parsed.sentiment)) {
          sentiment = parsed.sentiment;
        }
        confidence = Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50));
        signals = parsed.signals || "";
      }
    } catch (e) {
      console.log("Could not parse sentiment JSON");
    }

    // Update the conversation log with sentiment
    const { error: updateError } = await supabase
      .from("conversation_logs")
      .update({ sentiment })
      .eq("id", logId);

    if (updateError) {
      console.error("Failed to update sentiment:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        sentiment,
        confidence,
        signals
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Analyze sentiment error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to analyze sentiment" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
