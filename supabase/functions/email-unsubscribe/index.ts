import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  const html = (title: string, message: string) => `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:560px;margin:64px auto;padding:24px;color:#111827"><h1>${title}</h1><p>${message}</p></body></html>`;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return new Response(html("Invalid link", "This unsubscribe link is invalid."), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });

  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: record } = await client.from("email_unsubscribe_tokens").select("id,user_id,lead_id,email_normalized,unsubscribed_at").eq("token", token).maybeSingle();
  if (!record) return new Response(html("Invalid link", "This unsubscribe link is invalid or expired."), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (!record.unsubscribed_at) {
    const { data: membership } = await client.from("workspace_memberships").select("workspace_id").eq("user_id", record.user_id).limit(1).maybeSingle();
    if (membership?.workspace_id) await client.from("contact_suppression").upsert({ workspace_id: membership.workspace_id, value_type: "email", value_normalized: record.email_normalized, reason: "Email unsubscribe", source: "email_unsubscribe", added_by: record.user_id }, { onConflict: "workspace_id,value_type,value_normalized" });
    await client.from("lead_campaign_enrollments").update({ status: "unsubscribed" }).eq("lead_id", record.lead_id);
    await client.from("email_unsubscribe_tokens").update({ unsubscribed_at: new Date().toISOString() }).eq("id", record.id);
  }
  return new Response(html("You’re unsubscribed", "You will no longer receive marketing emails from this sender."), { headers: { "Content-Type": "text/html; charset=utf-8" } });
});