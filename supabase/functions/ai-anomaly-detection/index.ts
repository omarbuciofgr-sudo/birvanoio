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

    const { data: leads } = await supabase.from("leads").select("status, created_at, lead_score").order("created_at", { ascending: false }).limit(500);
    const { data: activities } = await supabase.from("conversation_logs").select("type, created_at").order("created_at", { ascending: false }).limit(300);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a metrics anomaly detection AI. Analyze CRM data to find unusual patterns, spikes, drops, or deviations from trends. Current date: " + new Date().toISOString() },
          { role: "user", content: `Detect anomalies in:\nLeads (${leads?.length}): ${JSON.stringify(leads?.slice(0, 100))}\nActivities (${activities?.length}): ${JSON.stringify(activities?.slice(0, 100))}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "anomaly_report",
            description: "Return anomaly detection results",
            parameters: {
              type: "object",
              properties: {
                anomalies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      metric: { type: "string" },
                      severity: { type: "string", enum: ["critical", "warning", "info"] },
                      description: { type: "string" },
                      expected_value: { type: "string" },
                      actual_value: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["metric", "severity", "description", "recommendation"],
                    additionalProperties: false,
                  },
                },
                overall_health: { type: "string", enum: ["healthy", "needs_attention", "critical"] },
                summary: { type: "string" },
              },
              required: ["anomalies", "overall_health", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "anomaly_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const report = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(report), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-anomaly-detection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
