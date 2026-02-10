import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_MODELS = new Set(["chatgpt-4o-latest", "gpt-4o", "gpt-4o-mini"]);

function getAIConfig(model: string) {
  const useOpenAI = OPENAI_MODELS.has(model);
  if (useOpenAI) {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OpenAI API key not configured");
    return { url: "https://api.openai.com/v1/chat/completions", key, model };
  }
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key, model };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const selectedModel = body.model || "google/gemini-3-flash-preview";

    const isWebScraperFormat = Array.isArray(body.messages) && body.context;

    if (isWebScraperFormat) {
      return await handleWebScraperChat(body, selectedModel);
    } else {
      return await handleLandingChatbot(body, req, selectedModel);
    }
  } catch (error: any) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process message. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

async function callAI(messages: any[], model: string) {
  const config = getAIConfig(model);
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: config.model, messages }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Usage limit reached. Please add credits." }),
        { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const errText = await response.text();
    console.error("AI error:", response.status, errText);
    throw new Error("AI gateway error");
  }

  return response;
}

// ── Web Scraper AI Assistant ──────────────────────────────────
async function handleWebScraperChat(body: any, model: string) {
  const { messages } = body;

  if (!messages || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "Messages are required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const aiMessages = [
    {
      role: "system",
      content: `You are an AI assistant for a B2B sales prospecting and lead generation platform. You help users:

1. Find companies and leads based on industry, location, and other criteria
2. Suggest search strategies for different types of prospects
3. Explain how to use the platform's tools (prospect search, real estate scraper, CSV enrichment, web search)
4. Provide tips on lead qualification and outreach

Be concise, actionable, and helpful. If a user asks to find specific types of companies, suggest which tool tab to use and what filters to apply. Keep responses to 2-3 sentences unless more detail is needed.`
    },
    ...messages,
  ];

  const aiResponse = await callAI(aiMessages, model);
  if (aiResponse instanceof Response && aiResponse.status !== 200) return aiResponse;

  const aiData = await (aiResponse as Response).json();
  const responseContent = aiData.choices?.[0]?.message?.content || "I'm here to help! What are you looking for?";

  return new Response(
    JSON.stringify({ response: responseContent }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

// ── Landing Page Chatbot ──────────────────────────────────────
async function handleLandingChatbot(body: any, req: Request, model: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const { message, sessionId, conversationHistory } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Message is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  if (message.length > 2000) {
    return new Response(
      JSON.stringify({ error: "Message must be less than 2000 characters" }),
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

  const { data: rateLimitOk } = await supabase.rpc('check_chat_rate_limit', { 
    session_uuid: sessionId 
  });
  
  if (rateLimitOk === false) {
    return new Response(
      JSON.stringify({ error: "Too many messages. Please wait a moment before sending more." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count: ipMessageCount } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);

  if (ipMessageCount && ipMessageCount > 100) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const aiMessages = [
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

  const aiResponse = await callAI(aiMessages, model);
  if (aiResponse instanceof Response && aiResponse.status !== 200) return aiResponse;

  const aiData = await (aiResponse as Response).json();
  let responseContent = aiData.choices?.[0]?.message?.content || "I'm here to help! What can I tell you about Brivano?";

  let captured: any = null;
  const capturedMatch = responseContent.match(/\{"captured":\s*\{[^}]+\}\}/);
  if (capturedMatch) {
    try {
      const capturedData = JSON.parse(capturedMatch[0]);
      captured = capturedData.captured;
      responseContent = responseContent.replace(capturedMatch[0], "").trim();
    } catch (e) {
      console.log("Could not parse captured data");
    }
  }

  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    sender_type: "support",
    message: responseContent,
    ai_qualified: !!captured,
    visitor_name: captured?.name || null,
    visitor_email: captured?.email || null,
    visitor_phone: captured?.phone || null,
  });

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
}
