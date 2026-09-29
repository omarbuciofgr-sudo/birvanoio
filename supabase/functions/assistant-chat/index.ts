import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { AI_LIMIT_MESSAGE, getAiAllowance, recordAiMessage, serviceClient } from "../_shared/billing.ts";
import { runLoop, runTool, trimHistory, type Card, type Ctx, type Msg } from "../_shared/assistant.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.union([
  z.object({ thread_id: z.string().uuid().optional(), message: z.string().trim().min(1).max(4000) }),
  z.object({ thread_id: z.string().uuid(), action_id: z.string().uuid(), decision: z.enum(["confirm", "cancel"]) }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await db.auth.getUser();
    if (!user) return json({ error: "Please sign in." }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Something was wrong with that request." }, 400);
    const body = parsed.data;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "The assistant is temporarily unavailable." }, 503);
    const allowance = await getAiAllowance(user.id);
    if (allowance.used >= allowance.limit) return json({ error: AI_LIMIT_MESSAGE, code: "ai_limit" }, 429);

    const admin = serviceClient();
    const [{ data: modelRow }, { data: profile }] = await Promise.all([
      admin.from("ai_settings").select("setting_value").eq("setting_key", "claude_model").maybeSingle(),
      admin.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
    ]);
    const model = modelRow?.setting_value || "claude-sonnet-4-5";
    const ctx: Ctx = { db, userId: user.id, tz: profile?.timezone || "America/Chicago", mode: "interactive", authHeader, spent: 0, toolsUsed: [] };

    // Thread
    let threadId = body.thread_id;
    if (threadId) {
      const { data: t } = await admin.from("assistant_threads").select("id").eq("id", threadId).eq("user_id", user.id).maybeSingle();
      if (!t) return json({ error: "Chat not found." }, 404);
    } else {
      const title = "message" in body ? body.message.slice(0, 60) : "New chat";
      const { data: t, error } = await admin.from("assistant_threads").insert({ user_id: user.id, title }).select("id").single();
      if (error) throw error;
      threadId = t.id;
    }
    const save = async (m: Msg, cards: Card[]) => {
      const { error } = await admin.from("assistant_messages").insert({ thread_id: threadId, user_id: user.id, role: m.role, content: m.content, ui: cards });
      if (error) console.error("save message failed", error);
    };

    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        send({ type: "thread", thread_id: threadId });
        let tokens = { tokensIn: 0, tokensOut: 0 };
        try {
          // Build the user turn: resolve any pending action first.
          const { data: pend } = await admin.from("assistant_pending_actions").select("*").eq("thread_id", threadId).eq("user_id", user.id).eq("status", "pending");
          const content: Record<string, unknown>[] = [];
          const uiCards: Card[] = [];
          for (const p of pend ?? []) {
            const confirming = "action_id" in body && body.action_id === p.id && body.decision === "confirm" && new Date(p.expires_at) > new Date();
            const { data: claimed } = await admin.from("assistant_pending_actions").update({ status: confirming ? "confirmed" : "cancelled" }).eq("id", p.id).eq("status", "pending").select("id");
            if (!claimed?.length) continue;
            content.push(...(p.other_results as Record<string, unknown>[]));
            if (confirming) {
              const r = await runTool(p.tool, p.args, ctx).catch((e) => { console.error("action failed", e); return { result: { error: "That didn't work. Please try again." } } as { result: unknown; cards?: Card[] }; });
              const failed = !!(r.result as { error?: string })?.error;
              await admin.from("assistant_pending_actions").update({ status: failed ? "failed" : "done" }).eq("id", p.id);
              content.push({ type: "tool_result", tool_use_id: p.tool_use_id, content: `<data>${JSON.stringify(r.result)}</data>` });
              const done: Card = { type: "action_result", action_id: p.id, summary: p.summary, ok: !failed, error: (r.result as { error?: string })?.error ?? null };
              uiCards.push(done, ...(r.cards ?? []));
              send({ type: "card", card: done });
              (r.cards ?? []).forEach((c) => send({ type: "card", card: c }));
            } else {
              content.push({ type: "tool_result", tool_use_id: p.tool_use_id, content: JSON.stringify({ cancelled: true, note: "The user cancelled this action." }) });
              const c: Card = { type: "action_result", action_id: p.id, summary: p.summary, ok: false, cancelled: true };
              uiCards.push(c);
              send({ type: "card", card: c });
            }
          }
          if ("message" in body) content.push({ type: "text", text: body.message });
          if (!content.length) { send({ type: "done" }); controller.close(); return; }
          await save({ role: "user", content }, uiCards);

          const { data: rows } = await admin.from("assistant_messages").select("role, content").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(40);
          const history = trimHistory(((rows ?? []) as Msg[]).reverse());

          tokens = await runLoop({
            ctx, history, apiKey, model, save,
            onText: (t) => send({ type: "text", text: t }),
            onCard: (c) => send({ type: "card", card: c }),
            requestConfirm: async (p) => {
              const { data: row } = await admin.from("assistant_pending_actions").insert({
                thread_id: threadId, user_id: user.id, tool_use_id: p.toolUseId, tool: p.tool, args: p.args,
                summary: p.summary, credit_cost: p.cost, other_results: p.otherResults,
              }).select("id").single();
              const card: Card = { type: "confirm", action_id: row.id, summary: p.summary, cost: p.cost };
              send({ type: "card", card });
              // Show the card on the assistant message that asked for it.
              const { data: last } = await admin.from("assistant_messages").select("id, ui").eq("thread_id", threadId).eq("role", "assistant").order("created_at", { ascending: false }).limit(1).maybeSingle();
              if (last) await admin.from("assistant_messages").update({ ui: [...(last.ui as Card[]), card] }).eq("id", last.id);
            },
          });
          await recordAiMessage(user.id).catch(() => {});
          await admin.from("assistant_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
        } catch (e) {
          console.error("assistant-chat loop error", e);
          send({ type: "error", message: (e as Error).message === "busy" ? "The assistant is busy right now. Please try again in a minute." : "Something went wrong. Please try again." });
        } finally {
          await admin.from("ai_usage_logs").insert({
            user_id: user.id, task: "assistant", model, input_tokens: tokens.tokensIn, output_tokens: tokens.tokensOut, success: true,
            tools: ctx.toolsUsed,
          }).then(() => {}, () => {});
          send({ type: "done" });
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("assistant-chat error", e);
    return json({ error: "The assistant is temporarily unavailable." }, 500);
  }
});
