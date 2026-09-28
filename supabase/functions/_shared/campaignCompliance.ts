import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);

export async function appendComplianceFooter(client: SupabaseClient, userId: string, leadId: string, recipientEmail: string, html: string) {
  const [{ data: profile }, { data: membership }] = await Promise.all([
    client.from("profiles").select("mailing_address").eq("user_id", userId).maybeSingle(),
    client.from("workspace_memberships").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  let mailingAddress = profile?.mailing_address?.trim() ?? "";
  if (!mailingAddress && membership?.workspace_id) {
    const { data: settings } = await client.from("workspace_settings").select("mailing_address").eq("workspace_id", membership.workspace_id).maybeSingle();
    mailingAddress = settings?.mailing_address?.trim() ?? "";
  }
  if (!mailingAddress) throw new Error("Add your business mailing address before sending. It's required by law in every marketing email.");

  const { data: existing } = await client.from("email_unsubscribe_tokens").select("token").eq("user_id", userId).eq("lead_id", leadId).maybeSingle();
  let token = existing?.token;
  if (!token) {
    const { data: created, error } = await client.from("email_unsubscribe_tokens").insert({ user_id: userId, lead_id: leadId, email_normalized: recipientEmail.trim().toLowerCase() }).select("token").single();
    if (error || !created?.token) throw new Error("Could not create unsubscribe link");
    token = created.token;
  }
  const functionsUrl = `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "")}/functions/v1`;
  return `${html}<div style="margin-top:32px;padding-top:16px;border-top:1px solid #d1d5db;color:#6b7280;font-size:12px;line-height:1.5"><div>${escapeHtml(mailingAddress)}</div><div><a href="${functionsUrl}/email-unsubscribe?token=${encodeURIComponent(token)}">Unsubscribe</a> from future marketing emails.</div></div>`;
}