import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const normalizePhone = (value: string) => { const digits = value.replace(/\D/g, ""); return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits; };
async function validSignature(signature: string, url: string, params: Record<string, string>, secret: string) {
  let input = url;
  for (const key of Object.keys(params).sort()) input += key + params[key];
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return signature === encodeBase64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)));
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const signature = req.headers.get("X-Twilio-Signature");
  const secret = Deno.env.get("TWILIO_AUTH_TOKEN");
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => { params[key] = String(value); });
  if (!signature || !secret || !(await validSignature(signature, req.url, params, secret))) return new Response("Unauthorized", { status: 401 });

  const keyword = (params.Body || "").trim().toUpperCase();
  if (!["STOP", "UNSUBSCRIBE", "CANCEL"].includes(keyword)) return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  const from = normalizePhone(params.From || "");
  const to = params.To || "";
  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  let userId: string | null = null;
  const { data: number } = await client.from("user_phone_numbers").select("user_id").eq("phone_number", to).maybeSingle();
  userId = number?.user_id ?? null;
  if (!userId) {
    const { data: profile } = await client.from("profiles").select("user_id").eq("twilio_phone_number", to).maybeSingle();
    userId = profile?.user_id ?? null;
  }
  if (userId && from) {
    const { data: membership } = await client.from("workspace_memberships").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle();
    if (membership?.workspace_id) {
      await client.from("contact_suppression").upsert({ workspace_id: membership.workspace_id, value_type: "phone", value_normalized: from, reason: `Text reply: ${keyword}`, source: "sms_opt_out", added_by: userId }, { onConflict: "workspace_id,value_type,value_normalized" });
      const { data: members } = await client.from("workspace_memberships").select("user_id").eq("workspace_id", membership.workspace_id);
      const ids = (members || []).map((row) => row.user_id);
      if (ids.length) {
        const { data: leads } = await client.from("leads").select("id,phone").in("client_id", ids);
        const matchingIds = (leads || []).filter((lead) => normalizePhone(lead.phone || "") === from).map((lead) => lead.id);
        if (matchingIds.length) await client.from("leads").update({ do_not_contact: true, do_not_contact_at: new Date().toISOString(), do_not_contact_reason: `Text reply: ${keyword}` }).in("id", matchingIds);
      }
    }
  }
  return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
});