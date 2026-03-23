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

    const { query } = await req.json();

    // Fetch relevant data based on query
    const { data: leads } = await supabase.from("leads").select("status, lead_score, industry, city, state, created_at, contacted_at, converted_at").limit(500);
    const { data: convLogs } = await supabase.from("conversation_logs").select("type, direction, created_at, sentiment").limit(200);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a business intelligence analyst. Answer questions about CRM data with specific numbers and insights. Format data for chart visualization when appropriate." },
          { role: "user", content: `Question: "${query}"\n\nLead data summary (${leads?.length || 0} leads): ${JSON.stringify(leads?.slice(0, 100))}\nActivity logs (${convLogs?.length || 0} activities): ${JSON.stringify(convLogs?.slice(0, 50))}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_response",
            description: "Return structured report response",
            parameters: {
              type: "object",
              properties: {
                answer: { type: "string", description: "Natural language answer to the question" },
                chart_data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { label: { type: "string" }, value: { type: "number" } },
                    required: ["label", "value"],
                    additionalProperties: false,
                  },
                  description: "Data for chart visualization if applicable",
                },
                chart_type: { type: "string", enum: ["bar", "pie", "line", "none"] },
                key_metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { label: { type: "string" }, value: { type: "string" }, trend: { type: "string", enum: ["up", "down", "flat"] } },
                    required: ["label", "value"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["answer", "chart_type"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_response" } },
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
    console.error("ai-nl-reports error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
