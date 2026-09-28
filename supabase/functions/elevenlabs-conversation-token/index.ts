import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user: ${userId}`);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    
    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "ElevenLabs not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the user's own configured ElevenLabs agent ID; ignore any client-supplied value
    const serviceClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? SUPABASE_ANON_KEY,
    );
    const input = z.object({ leadId: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
    if (!input.success) return new Response(JSON.stringify({ error: "A lead is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const [{ data: compliance }, { data: lead }] = await Promise.all([
      serviceClient.from("profiles").select("communication_compliance_accepted_at").eq("user_id", userId).maybeSingle(),
      serviceClient.from("leads").select("client_id,voice_consent_at,do_not_contact").eq("id", input.data.leadId).maybeSingle(),
    ]);
    if (!compliance?.communication_compliance_accepted_at) return new Response(JSON.stringify({ error: "Accept the outreach compliance notice before calling." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!lead || lead.client_id !== userId || !lead.voice_consent_at || lead.do_not_contact) return new Response(JSON.stringify({ error: "AI Voice Agent calls require recorded consent from this lead." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("elevenlabs_agent_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to load profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentId = profile?.elevenlabs_agent_id;
    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "No ElevenLabs agent configured for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching conversation token for user ${userId}, agent: ${agentId}`);



    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to get conversation token" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ token: data.token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in elevenlabs-conversation-token:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});