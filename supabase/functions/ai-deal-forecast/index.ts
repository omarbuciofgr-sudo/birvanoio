import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch pipeline data
    const { data: leads } = await supabase.from("leads").select("id, status, lead_score, created_at, contacted_at, converted_at, industry, estimated_revenue").limit(500);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a deal forecasting AI. Analyze pipeline data and return JSON with tool calling." },
          { role: "user", content: `Analyze this pipeline and forecast deals:\n${JSON.stringify(leads?.slice(0, 100))}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "deal_forecast",
            description: "Return deal forecast analysis",
            parameters: {
              type: "object",
              properties: {
                win_probability: { type: "number", description: "Overall pipeline win probability 0-100" },
                projected_revenue: { type: "string", description: "Projected monthly revenue" },
                forecast_confidence: { type: "number", description: "Confidence in forecast 0-100" },
                pipeline_health: { type: "string", enum: ["strong", "moderate", "weak"] },
                insights: { type: "array", items: { type: "object", properties: { insight: { type: "string" }, impact: { type: "string", enum: ["high", "medium", "low"] } }, required: ["insight", "impact"] } },
                at_risk_deals: { type: "number", description: "Number of deals at risk" },
                recommendations: { type: "array", items: { type: "string" } },
              },
              required: ["win_probability", "projected_revenue", "forecast_confidence", "pipeline_health", "insights", "at_risk_deals", "recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "deal_forecast" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const forecast = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(forecast), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-deal-forecast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
