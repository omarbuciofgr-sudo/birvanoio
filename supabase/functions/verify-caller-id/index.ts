import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const e164Regex = /^\+[1-9]\d{1,14}$/;

const inputSchema = z.object({
  action: z.enum(["start_verification", "check_status"]),
  phoneNumber: z.string().regex(e164Regex, "Phone number must be in E.164 format").optional(),
  phoneNumberId: z.string().uuid().optional(),
  label: z.string().max(50).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: "Phone verification service unavailable" }), {
        status: 503, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rawInput = await req.json();
    const validation = inputSchema.safeParse(rawInput);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: validation.error.errors.map(e => e.message) }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { action, phoneNumber, phoneNumberId, label } = validation.data;
    const credentials = btoa(`${accountSid}:${authToken}`);

    if (action === "start_verification") {
      if (!phoneNumber) {
        return new Response(JSON.stringify({ error: "Phone number is required" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Start Twilio outgoing caller ID verification
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json`;
      
      // First create the validation request
      const validationUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json`;
      const formData = new URLSearchParams();
      formData.append("PhoneNumber", phoneNumber);
      formData.append("FriendlyName", label || "Brivano Verified Number");

      // Use the validation resource endpoint
      const createUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json`;
      
      // Twilio's caller ID verification uses a different endpoint
      const verifyResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        }
      );

      // Twilio returns a validation code for the user to enter during the call
      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        console.error("Twilio verification error:", verifyData);
        const msg = verifyData?.message?.includes("already been validated")
          ? "This phone number is already verified."
          : "Failed to start verification. Please check the phone number.";
        return new Response(JSON.stringify({ error: msg }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Save to database
      const { data: saved, error: saveError } = await supabase.from("user_phone_numbers").insert({
        user_id: user.id,
        phone_number: phoneNumber,
        label: label || "Primary",
        verification_status: "pending",
        twilio_validation_code: verifyData.validation_code?.toString() || null,
      }).select().single();

      if (saveError) {
        console.error("Save error:", saveError);
        return new Response(JSON.stringify({ error: "Failed to save phone number" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        phoneNumberId: saved.id,
        validationCode: verifyData.validation_code,
        message: "Twilio will call your phone. When prompted, enter the validation code shown below.",
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "check_status") {
      if (!phoneNumberId) {
        return new Response(JSON.stringify({ error: "phoneNumberId is required" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Get the phone number record
      const { data: phoneRecord } = await supabase
        .from("user_phone_numbers")
        .select("*")
        .eq("id", phoneNumberId)
        .eq("user_id", user.id)
        .single();

      if (!phoneRecord) {
        return new Response(JSON.stringify({ error: "Phone number not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Check Twilio for verified caller IDs matching this number
      const listUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(phoneRecord.phone_number)}`;
      const listResponse = await fetch(listUrl, {
        headers: { "Authorization": `Basic ${credentials}` },
      });
      const listData = await listResponse.json();

      const isVerified = listData.outgoing_caller_ids?.length > 0;

      if (isVerified && phoneRecord.verification_status !== "verified") {
        await supabase.from("user_phone_numbers").update({
          verification_status: "verified",
          verified_at: new Date().toISOString(),
        }).eq("id", phoneNumberId);
      }

      return new Response(JSON.stringify({
        verified: isVerified,
        status: isVerified ? "verified" : "pending",
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Verify caller ID error:", error);
    return new Response(JSON.stringify({ error: "Verification failed" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
