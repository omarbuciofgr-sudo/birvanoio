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

    const { transcript, lead, call_duration } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a meeting notes AI. Summarize call transcripts/notes into structured action items, key points, and follow-ups." },
          { role: "user", content: `Summarize this call:\nLead: ${JSON.stringify(lead)}\nDuration: ${call_duration || 'Unknown'}\nTranscript/Notes: ${transcript}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "meeting_summary",
            description: "Return meeting summary",
            parameters: {
              type: "object",
              properties: {
                executive_summary: { type: "string", description: "2-3 sentence summary" },
                key_points: { type: "array", items: { type: "string" } },
                action_items: { type: "array", items: { type: "object", properties: { task: { type: "string" }, owner: { type: "string" }, deadline: { type: "string" }, priority: { type: "string", enum: ["high", "medium", "low"] } }, required: ["task", "owner", "priority"], additionalProperties: false } },
                decisions_made: { type: "array", items: { type: "string" } },
                follow_up_date: { type: "string", description: "Suggested follow-up date" },
                sentiment: { type: "string", enum: ["very_positive", "positive", "neutral", "negative", "very_negative"] },
                deal_progress: { type: "string", enum: ["advancing", "stalled", "at_risk", "closed"] },
                next_steps: { type: "array", items: { type: "string" } },
              },
              required: ["executive_summary", "key_points", "action_items", "sentiment", "deal_progress", "next_steps"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "meeting_summary" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI service error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    const summary = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-meeting-notes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
