const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead, channels, tone, goal } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert B2B outreach copywriter. Generate a multi-step outreach sequence for a sales lead.

Rules:
- Each step should have a clear subject line (for email) or opening hook (for SMS/LinkedIn)
- Personalize using the lead's business name, industry, and any available context
- Keep emails under 150 words, SMS under 160 characters, LinkedIn messages under 300 characters
- Vary the angle across steps (intro, value prop, social proof, urgency, breakup)
- Match the requested tone and goal

Return a JSON array of steps, each with: { "step": number, "channel": "email"|"sms"|"linkedin", "delay_days": number, "subject": string, "body": string }`;

    const userPrompt = `Generate a ${channels.length}-step outreach sequence for:

Business: ${lead.business_name}
Industry: ${lead.industry || "Unknown"}
Contact: ${lead.contact_name || "Decision Maker"}
Location: ${[lead.city, lead.state].filter(Boolean).join(", ") || "Unknown"}

Channels to use: ${channels.join(", ")}
Tone: ${tone || "professional"}
Goal: ${goal || "book a meeting"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_outreach_sequence",
              description: "Return a multi-step outreach sequence",
              parameters: {
                type: "object",
                properties: {
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        step: { type: "number" },
                        channel: { type: "string", enum: ["email", "sms", "linkedin"] },
                        delay_days: { type: "number" },
                        subject: { type: "string" },
                        body: { type: "string" },
                      },
                      required: ["step", "channel", "delay_days", "subject", "body"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["steps"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_outreach_sequence" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI service error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse content directly
    const content = data.choices?.[0]?.message?.content || "[]";
    return new Response(JSON.stringify({ steps: JSON.parse(content) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-outreach-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
