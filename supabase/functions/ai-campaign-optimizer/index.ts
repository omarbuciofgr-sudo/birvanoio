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

    const { campaign_id } = await req.json();

    const { data: campaign } = await supabase.from("email_campaigns").select("*").eq("id", campaign_id).single();
    const { data: steps } = await supabase.from("email_campaign_steps").select("*").eq("campaign_id", campaign_id).order("step_order");
    const { data: enrollments } = await supabase.from("lead_campaign_enrollments").select("*, lead:leads(status, lead_score, industry)").eq("campaign_id", campaign_id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a campaign optimization AI. Analyze email campaign performance and suggest improvements for timing, messaging, and targeting." },
          { role: "user", content: `Optimize this campaign:\nCampaign: ${JSON.stringify(campaign)}\nSteps: ${JSON.stringify(steps)}\nEnrollments: ${JSON.stringify(enrollments?.slice(0, 50))}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "campaign_optimization",
            description: "Return campaign optimization suggestions",
            parameters: {
              type: "object",
              properties: {
                overall_score: { type: "number", description: "Campaign effectiveness score 0-100" },
                timing_suggestions: { type: "array", items: { type: "string" } },
                messaging_improvements: { type: "array", items: { type: "object", properties: { step: { type: "number" }, current_issue: { type: "string" }, suggestion: { type: "string" } }, required: ["step", "current_issue", "suggestion"], additionalProperties: false } },
                audience_insights: { type: "array", items: { type: "string" } },
                ab_test_ideas: { type: "array", items: { type: "object", properties: { element: { type: "string" }, variant_a: { type: "string" }, variant_b: { type: "string" } }, required: ["element", "variant_a", "variant_b"], additionalProperties: false } },
                summary: { type: "string" },
              },
              required: ["overall_score", "timing_suggestions", "messaging_improvements", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "campaign_optimization" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const optimization = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(optimization), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-campaign-optimizer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
