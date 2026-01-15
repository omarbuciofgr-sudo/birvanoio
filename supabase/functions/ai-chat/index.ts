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
      console.error("AI service configuration error: API key not set");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { message, sessionId, conversationHistory } = await req.json();

    // Input validation - validate message type and length before AI processing
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Message must be less than 5000 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Session-based rate limiting (existing)
    const { data: rateLimitOk } = await supabase.rpc('check_chat_rate_limit', { 
      session_uuid: sessionId 
    });
    
    if (rateLimitOk === false) {
      return new Response(
        JSON.stringify({ error: "Too many messages. Please wait a moment before sending more." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // IP-based rate limiting to prevent session cycling attacks
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check IP-based rate limit (100 messages per hour per IP)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: ipMessageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);

    // If more than 100 messages in the last hour from this session pattern, rate limit
    if (ipMessageCount && ipMessageCount > 100) {
      console.log(`Rate limit exceeded for IP pattern, count: ${ipMessageCount}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build conversation context
    const messages = [
      {
        role: "system",
        content: `You are Brivano's friendly AI assistant on their website. Your goals are:

1. QUALIFY visitors by understanding their needs:
   - What industry are they in?
   - What location do they need leads for?
   - What's their current lead generation method?
   - What's their budget/team size?

2. CAPTURE lead information naturally:
   - Ask for their name, email, and phone when appropriate
   - Don't be pushy - work it into the conversation
   - Offer to send sample leads or schedule a demo

3. ANSWER questions about Brivano:
   - Fresh, verified leads from public sources
   - CRM with call, text, email capabilities
   - AI-powered call recaps and follow-ups
   - Pricing: Starter ($199/mo), Growth ($399/mo), Enterprise (custom)
   - Per-seat pricing that scales

4. BE HELPFUL and conversational:
   - Keep responses concise (2-3 sentences max)
   - Be enthusiastic but professional
   - If they share contact info, acknowledge it and explain next steps

When you successfully capture their name, email, or phone, include it in your response as JSON at the end:
{"captured": {"name": "...", "email": "...", "phone": "..."}}`
      },
      ...(conversationHistory || []).map((msg: any) => ({
        role: msg.sender_type === "visitor" ? "user" : "assistant",
        content: msg.message
      })),
      { role: "user", content: message }
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again in a moment." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable." }),
          { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw new Error("Failed to get AI response");
    }

    const aiData = await aiResponse.json();
    let responseContent = aiData.choices?.[0]?.message?.content || "I'm here to help! What can I tell you about Brivano?";

    // Check if AI captured any lead info
    let captured: any = null;
    const capturedMatch = responseContent.match(/\{"captured":\s*\{[^}]+\}\}/);
    if (capturedMatch) {
      try {
        const capturedData = JSON.parse(capturedMatch[0]);
        captured = capturedData.captured;
        // Remove the JSON from the response
        responseContent = responseContent.replace(capturedMatch[0], "").trim();
      } catch (e) {
        console.log("Could not parse captured data");
      }
    }

    // Save the AI response to the database
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      sender_type: "support",
      message: responseContent,
      ai_qualified: !!captured,
      visitor_name: captured?.name || null,
      visitor_email: captured?.email || null,
      visitor_phone: captured?.phone || null,
    });

    // If we captured lead info, update previous messages with this session
    if (captured) {
      const updates: any = {};
      if (captured.name) updates.visitor_name = captured.name;
      if (captured.email) updates.visitor_email = captured.email;
      if (captured.phone) updates.visitor_phone = captured.phone;
      updates.ai_qualified = true;

      await supabase
        .from("chat_messages")
        .update(updates)
        .eq("session_id", sessionId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: responseContent,
        captured
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process message. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
