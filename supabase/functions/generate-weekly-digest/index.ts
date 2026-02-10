import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get auth header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create authenticated client to get user
    const supabaseAuth = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const clientId = user.id;

    // Fetch leads data for analysis
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [leadsResult, conversationsResult] = await Promise.all([
      supabaseAuth.from("leads").select("*").eq("client_id", clientId),
      supabaseAuth.from("conversation_logs").select("*").eq("client_id", clientId).gte("created_at", sevenDaysAgo.toISOString())
    ]);

    const leads = leadsResult.data || [];
    const conversations = conversationsResult.data || [];

    // Calculate stats
    const totalLeads = leads.length;
    const newLeadsThisWeek = leads.filter(l => new Date(l.created_at) >= sevenDaysAgo).length;
    const convertedThisWeek = leads.filter(l => l.status === "converted" && l.converted_at && new Date(l.converted_at) >= sevenDaysAgo).length;
    const contactedThisWeek = leads.filter(l => l.status === "contacted" && l.contacted_at && new Date(l.contacted_at) >= sevenDaysAgo).length;
    
    const statusBreakdown = {
      new: leads.filter(l => l.status === "new").length,
      contacted: leads.filter(l => l.status === "contacted").length,
      qualified: leads.filter(l => l.status === "qualified").length,
      converted: leads.filter(l => l.status === "converted").length,
      lost: leads.filter(l => l.status === "lost").length,
    };

    // Get top scoring leads
    const topLeads = leads
      .filter(l => l.lead_score !== null && l.status !== "converted" && l.status !== "lost")
      .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
      .slice(0, 5)
      .map(l => ({
        business_name: l.business_name,
        contact_name: l.contact_name,
        lead_score: l.lead_score,
        status: l.status,
        industry: l.industry,
        city: l.city,
        state: l.state
      }));

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 
      ? ((statusBreakdown.converted / totalLeads) * 100).toFixed(1)
      : "0";

    // Get recent communication stats
    const callsThisWeek = conversations.filter(c => c.type === "call").length;
    const emailsThisWeek = conversations.filter(c => c.type === "email").length;
    const smsThisWeek = conversations.filter(c => c.type === "sms").length;

    // Build prompt for AI analysis
    const analysisPrompt = `You are an AI sales analyst. Generate a concise weekly digest summary based on this lead data:

LEAD STATS:
- Total Leads: ${totalLeads}
- New Leads This Week: ${newLeadsThisWeek}
- Contacted This Week: ${contactedThisWeek}
- Converted This Week: ${convertedThisWeek}
- Overall Conversion Rate: ${conversionRate}%

STATUS BREAKDOWN:
- New: ${statusBreakdown.new}
- Contacted: ${statusBreakdown.contacted}
- Qualified: ${statusBreakdown.qualified}
- Converted: ${statusBreakdown.converted}
- Lost: ${statusBreakdown.lost}

COMMUNICATION ACTIVITY THIS WEEK:
- Calls: ${callsThisWeek}
- Emails: ${emailsThisWeek}
- SMS: ${smsThisWeek}

TOP SCORING LEADS (prioritize follow-up):
${topLeads.length > 0 ? topLeads.map((l, i) => `${i + 1}. ${l.business_name} (Score: ${l.lead_score}) - ${l.status} - ${l.city}, ${l.state}`).join("\n") : "No scored leads yet"}

Generate a response with exactly these sections:
1. **Weekly Highlights** - 2-3 sentences summarizing key wins and metrics
2. **Recommended Actions** - 3-5 specific, actionable recommendations based on the data
3. **Top Priority Leads** - Brief commentary on which leads to focus on and why
4. **Trends to Watch** - Any patterns or concerns that need attention

Keep the tone professional but encouraging. Be specific with numbers and names where applicable.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a helpful sales analytics AI that provides actionable insights." },
          { role: "user", content: analysisPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw new Error("Failed to get AI response");
    }

    const aiData = await aiResponse.json();
    const digestContent = aiData.choices?.[0]?.message?.content || "Unable to generate digest at this time.";

    return new Response(
      JSON.stringify({
        success: true,
        digest: digestContent,
        stats: {
          totalLeads,
          newLeadsThisWeek,
          contactedThisWeek,
          convertedThisWeek,
          conversionRate,
          statusBreakdown,
          communicationActivity: {
            calls: callsThisWeek,
            emails: emailsThisWeek,
            sms: smsThisWeek
          }
        },
        topLeads,
        generatedAt: new Date().toISOString()
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Weekly digest error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate digest" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
