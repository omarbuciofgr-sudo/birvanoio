import { serviceClient } from "../_shared/billing.ts";

const page = (msg: string) =>
  new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brivano alerts</title></head><body style="font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><div style="max-width:420px;text-align:center;padding:24px"><h1 style="font-size:20px">${msg}</h1><p style="color:#555">You can turn alerts back on anytime from Find Owners in Brivano.</p></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return page("This unsubscribe link isn't valid.");
  const { data } = await serviceClient().from("owner_search_alerts")
    .update({ is_active: false }).eq("unsubscribe_token", token).select("location").maybeSingle();
  return page(data ? `You're unsubscribed from alerts for ${data.location}.` : "This alert was already removed.");
});
