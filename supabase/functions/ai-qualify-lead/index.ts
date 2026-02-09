import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Analyze this lead and provide qualification insights:

Business: ${lead.business_name}
Industry: ${lead.industry || "Unknown"}
Contact: ${lead.contact_name || "Unknown"}
Email: ${lead.email || "None"}
Phone: ${lead.phone || "None"}
Location: ${[lead.city, lead.state].filter(Boolean).join(", ") || "Unknown"}
Website: ${lead.website || "None"}
Company Size: ${lead.company_size || "Unknown"}
Current Score: ${lead.lead_score ?? "Not scored"}
Status: ${lead.status}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a lead qualification expert. Analyze the lead and return structured qualification data. Be specific and actionable.`,
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "qualify_lead",
              description: "Return lead qualification analysis",
              parameters: {
                type: "object",
                properties: {
                  qualification: {
                    type: "string",
                    enum: ["hot", "warm", "cold"],
                  },
                  confidence: { type: "number" },
                  reasoning: { type: "string" },
                  buying_signals: {
                    type: "array",
                    items: { type: "string" },
                  },
                  risk_factors: {
                    type: "array",
                    items: { type: "string" },
                  },
                  next_actions: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["qualification", "confidence", "reasoning", "buying_signals", "risk_factors", "next_actions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "qualify_lead" } },
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
      throw new Error("AI service error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      return new Response(toolCall.function.arguments, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("No qualification data returned");
  } catch (e) {
    console.error("ai-qualify-lead error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
