import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { leads } = await req.json();

    // Get team members/orgs
    const { data: orgs } = await supabase.from("client_organizations").select("id, name").eq("is_active", true);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a lead routing AI. Assign leads to the best team/rep based on lead characteristics, industry expertise, and workload balance." },
          { role: "user", content: `Route these leads:\nLeads: ${JSON.stringify(leads)}\nAvailable teams: ${JSON.stringify(orgs || [])}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "routing_assignments",
            description: "Return lead routing assignments",
            parameters: {
              type: "object",
              properties: {
                assignments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lead_id: { type: "string" },
                      business_name: { type: "string" },
                      assigned_to: { type: "string", description: "Team or rep name" },
                      reason: { type: "string" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      suggested_approach: { type: "string" },
                    },
                    required: ["lead_id", "business_name", "assigned_to", "reason", "priority"],
                    additionalProperties: false,
                  },
                },
                routing_summary: { type: "string" },
              },
              required: ["assignments", "routing_summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "routing_assignments" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const routing = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(routing), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-smart-routing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
