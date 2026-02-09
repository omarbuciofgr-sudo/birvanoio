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

    const { lead } = await req.json();

    // Also fetch conversation history
    const { data: convLogs } = await supabase.from("conversation_logs").select("type, content, direction, created_at, sentiment").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(10);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a sales call preparation AI. Generate a comprehensive briefing document for an upcoming sales call." },
          { role: "user", content: `Prepare a call brief for:\nLead: ${JSON.stringify(lead)}\nPrevious interactions: ${JSON.stringify(convLogs || [])}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "call_brief",
            description: "Return call preparation brief",
            parameters: {
              type: "object",
              properties: {
                executive_summary: { type: "string", description: "2-3 sentence overview" },
                talking_points: { type: "array", items: { type: "string" } },
                questions_to_ask: { type: "array", items: { type: "string" } },
                objection_handlers: { type: "array", items: { type: "object", properties: { objection: { type: "string" }, response: { type: "string" } }, required: ["objection", "response"], additionalProperties: false } },
                key_pain_points: { type: "array", items: { type: "string" } },
                conversation_opener: { type: "string" },
                closing_strategy: { type: "string" },
                do_not_mention: { type: "array", items: { type: "string" } },
              },
              required: ["executive_summary", "talking_points", "questions_to_ask", "objection_handlers", "key_pain_points", "conversation_opener", "closing_strategy"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "call_brief" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const brief = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(brief), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-call-prep error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
