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

    // Get leads that are contacted or qualified but haven't progressed
    const { data: leads } = await supabase.from("leads").select("id, business_name, contact_name, status, lead_score, created_at, contacted_at, updated_at, industry").in("status", ["contacted", "qualified"]).order("updated_at", { ascending: true }).limit(100);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a churn detection AI. Identify leads that are going cold based on time since last activity, status progression, and engagement patterns. Current date: " + new Date().toISOString() },
          { role: "user", content: `Identify at-risk leads from this data:\n${JSON.stringify(leads)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "churn_analysis",
            description: "Return churn risk analysis",
            parameters: {
              type: "object",
              properties: {
                at_risk_leads: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lead_id: { type: "string" },
                      business_name: { type: "string" },
                      risk_level: { type: "string", enum: ["critical", "high", "moderate"] },
                      days_inactive: { type: "number" },
                      risk_reason: { type: "string" },
                      save_action: { type: "string", description: "Recommended action to save this lead" },
                    },
                    required: ["lead_id", "business_name", "risk_level", "days_inactive", "risk_reason", "save_action"],
                    additionalProperties: false,
                  },
                },
                total_at_risk: { type: "number" },
                churn_rate_estimate: { type: "string" },
                summary: { type: "string" },
              },
              required: ["at_risk_leads", "total_at_risk", "churn_rate_estimate", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "churn_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const analysis = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-churn-detection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
