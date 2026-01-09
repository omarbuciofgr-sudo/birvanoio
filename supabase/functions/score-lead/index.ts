import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Authentication check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user's auth to validate
    const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.user.id;

    const { leadId } = await req.json();

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "Lead ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role for data operations
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Authorization check: verify lead belongs to user or user is admin
    if (lead.client_id !== userId) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Lead does not belong to user" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Fetch conversation logs for this lead
    const { data: logs } = await supabase
      .from("conversation_logs")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    // Use AI to score the lead
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a lead scoring expert. Analyze the provided lead data and score them on a scale of 0-100 based on their likelihood to convert.

Consider these factors:
- Data completeness (email, phone, contact name, business name)
- Engagement level (number of interactions, types of communication)
- Status progression (new < contacted < qualified < converted)
- Industry (some industries may be higher value)
- Recency of interactions

Return ONLY a JSON object with:
- score: number between 0-100
- reasoning: brief explanation (max 50 words)`
          },
          {
            role: "user",
            content: `Score this lead:
            
Lead Data:
- Business Name: ${lead.business_name}
- Contact Name: ${lead.contact_name || "Not provided"}
- Email: ${lead.email ? "Provided" : "Not provided"}
- Phone: ${lead.phone ? "Provided" : "Not provided"}
- Industry: ${lead.industry || "Unknown"}
- Status: ${lead.status}
- Created: ${lead.created_at}
- Last Contacted: ${lead.contacted_at || "Never"}
- Notes: ${lead.notes || "None"}

Interaction History:
${logs?.length ? logs.map(l => `- ${l.type} (${l.direction || 'n/a'}) on ${new Date(l.created_at).toLocaleDateString()}`).join('\n') : "No interactions yet"}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw new Error("Failed to get AI response");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse the score from AI response
    let score = 50;
    let reasoning = "";
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = Math.min(100, Math.max(0, parseInt(parsed.score) || 50));
        reasoning = parsed.reasoning || "";
      }
    } catch (e) {
      console.log("Could not parse JSON, using default score");
    }

    // Update the lead with the score
    const { error: updateError } = await supabase
      .from("leads")
      .update({ lead_score: score })
      .eq("id", leadId);

    if (updateError) {
      console.error("Failed to update lead score:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        score, 
        reasoning 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Score lead error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to score lead" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
