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
    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getUser(token);

    if (authError || !data?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("AI service configuration error: API key not set");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { messageType, leadName, businessName, notes, context } = await req.json();

    if (!messageType || !["email", "sms"].includes(messageType)) {
      return new Response(
        JSON.stringify({ error: "Valid messageType (email or sms) is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const systemPrompt = messageType === "email" 
      ? `You are a professional sales assistant. Generate a compelling follow-up email based on the provided context.

Your email should:
- Be professional but personable
- Reference any notes or context provided
- Include a clear call-to-action
- Be concise (under 200 words)

Return ONLY a JSON object with:
- subject: email subject line
- body: email body content`
      : `You are a professional sales assistant. Generate a brief, engaging SMS message based on the provided context.

Your SMS should:
- Be under 160 characters
- Be conversational and friendly
- Include a clear next step or call-to-action
- Not feel spammy

Return ONLY a JSON object with:
- message: the SMS content`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a ${messageType} for:
            
Contact: ${leadName || "the contact"}
Business: ${businessName || "their company"}
Notes: ${notes || "No specific notes"}
Context: ${context || "Initial outreach"}`
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
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let result: any = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fallback content
      if (messageType === "email") {
        result = {
          subject: `Following up - ${leadName || "Your inquiry"}`,
          body: content
        };
      } else {
        result = { message: content.substring(0, 160) };
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        ...result
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Generate message error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate message" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
