import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { AI_LIMIT_MESSAGE, getAiAllowance, recordAiMessage, serviceClient } from "../_shared/billing.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) })).min(1).max(40),
});

const SYSTEM_PROMPT = `You are Brivano AI, an assistant inside Brivano, an app that helps real estate agents and property managers find homeowners selling or renting on their own (FSBO and FRBO), get their contact info, and follow up.

You help with: prospecting strategy, what to say to owners, handling objections, follow-up timing, using the app (Find Owners, My Leads, Outreach, follow-up plans, market reports), and general real estate sales advice.

Be friendly, short and practical. Plain language, no em dashes. Use short bullet points when listing things. Don't make up market numbers or facts about the user's data; if you don't know, say where in the app they can find it.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in." }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Something was wrong with that message." }, 400);
    // Claude requires the conversation to start with the user.
    const messages = parsed.data.messages.slice(parsed.data.messages.findIndex((m) => m.role === "user"));

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "The assistant is temporarily unavailable." }, 503);

    const allowance = await getAiAllowance(user.id);
    if (allowance.used >= allowance.limit) return json({ error: AI_LIMIT_MESSAGE, code: "ai_limit" }, 429);

    const admin = serviceClient();
    const { data: modelRow } = await admin.from("ai_settings").select("setting_value").eq("setting_key", "claude_model").maybeSingle();
    const model = modelRow?.setting_value || "claude-sonnet-4-5";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1024, system: SYSTEM_PROMPT, messages, stream: true }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text();
      console.error(`Anthropic error [${res.status}]: ${t}`);
      await admin.from("ai_usage_logs").insert({ user_id: user.id, task: "chat", model, success: false, error_code: `http_${res.status}` }).then(() => {}, () => {});
      return json({ error: res.status === 429 || res.status === 529 ? "The assistant is busy right now. Please try again in a minute." : "The assistant is temporarily unavailable." }, 502);
    }

    // Re-emit Claude's stream in the simple format the chat window reads.
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    let inTok = 0, outTok = 0;
    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i: number;
            while ((i = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, i).trim();
              buf = buf.slice(i + 1);
              if (!line.startsWith("data:")) continue;
              try {
                const ev = JSON.parse(line.slice(5).trim());
                if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
                  const text = String(ev.delta.text).replace(/\u2014/g, ", ");
                  controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
                } else if (ev.type === "message_start") inTok = ev.message?.usage?.input_tokens ?? 0;
                else if (ev.type === "message_delta") outTok = ev.usage?.output_tokens ?? outTok;
              } catch { /* skip partial */ }
            }
          }
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
        } finally {
          controller.close();
          await admin.from("ai_usage_logs").insert({ user_id: user.id, task: "chat", model, input_tokens: inTok, output_tokens: outTok, success: true }).then(() => {}, () => {});
          await recordAiMessage(user.id).catch(() => {});
        }
      },
    });
    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-dashboard-chat error:", e);
    return json({ error: "The assistant is temporarily unavailable." }, 500);
  }
});
