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

    const { data: leads } = await supabase.from("leads").select("id, business_name, contact_name, status, lead_score, email, phone, industry, created_at, contacted_at").in("status", ["new", "contacted", "qualified"]).order("created_at", { ascending: false }).limit(50);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a sales prioritization AI. Rank leads by urgency and potential. Consider recency, score, status, and data completeness." },
          { role: "user", content: `Prioritize these leads for today's outreach:\n${JSON.stringify(leads)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "prioritized_tasks",
            description: "Return prioritized daily task list",
            parameters: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lead_id: { type: "string" },
                      business_name: { type: "string" },
                      priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      action: { type: "string", description: "Recommended action" },
                      reason: { type: "string", description: "Why this is urgent" },
                      best_channel: { type: "string", enum: ["call", "email", "sms", "linkedin"] },
                      best_time: { type: "string", description: "Suggested time of day" },
                    },
                    required: ["lead_id", "business_name", "priority", "action", "reason", "best_channel"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string", description: "Brief summary of today's priorities" },
              },
              required: ["tasks", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "prioritized_tasks" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const priorities = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(priorities), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-smart-priority error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
