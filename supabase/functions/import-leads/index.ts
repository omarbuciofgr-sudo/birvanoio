import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema for a single lead
const leadSchema = z.object({
  business_name: z.string().min(1, "Business name is required").max(255),
  contact_name: z.string().max(255).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip_code: z.string().max(20).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  source_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  notes: z.string().max(2000).optional().nullable(),
});

// Request validation schema
const importSchema = z.object({
  targetClientId: z.string().uuid("Invalid client ID"),
  leads: z.array(leadSchema).min(1, "At least one lead is required").max(1000, "Maximum 1000 leads per import"),
});

// Sanitize error messages
const sanitizeError = (error: any, operation: string): { message: string; status: number } => {
  console.error(`Error in ${operation}:`, error);

  const errorMessage = error?.message?.toLowerCase() || "";

  if (errorMessage.includes("unauthorized") || errorMessage.includes("permission")) {
    return { message: "Unauthorized access", status: 403 };
  }

  if (errorMessage.includes("invalid") || errorMessage.includes("validation")) {
    return { message: "Invalid request parameters", status: 400 };
  }

  return { message: `Failed to ${operation}. Please try again or contact support.`, status: 500 };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user authentication
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Server-side admin role verification
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Error checking admin role:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!roleData) {
      console.warn(`Non-admin user ${user.id} attempted CSV import`);
      return new Response(
        JSON.stringify({ error: "Administrator access required for CSV import" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse and validate input
    const rawInput = await req.json();
    const validation = importSchema.safeParse(rawInput);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.errors.map(e => e.message) }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { targetClientId, leads } = validation.data;

    // Verify target client exists
    const { data: clientProfile, error: clientError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", targetClientId)
      .single();

    if (clientError || !clientProfile) {
      return new Response(
        JSON.stringify({ error: "Target client not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Admin ${user.id} importing ${leads.length} leads for client ${targetClientId}`);

    // Prepare leads for insertion
    const leadsToInsert = leads.map(lead => ({
      client_id: targetClientId,
      business_name: lead.business_name,
      contact_name: lead.contact_name || null,
      email: lead.email || null,
      phone: lead.phone || null,
      city: lead.city || null,
      state: lead.state || null,
      zip_code: lead.zip_code || null,
      industry: lead.industry || null,
      source_url: lead.source_url || null,
      notes: lead.notes || null,
      status: "new",
    }));

    // Batch insert leads
    const { data: insertedLeads, error: insertError } = await supabase
      .from("leads")
      .insert(leadsToInsert)
      .select("id");

    if (insertError) {
      console.error("Error inserting leads:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to import leads" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const successCount = insertedLeads?.length || 0;
    console.log(`Successfully imported ${successCount} leads`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: successCount,
        failed: leads.length - successCount 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    const { message, status } = sanitizeError(error, "import leads");
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
