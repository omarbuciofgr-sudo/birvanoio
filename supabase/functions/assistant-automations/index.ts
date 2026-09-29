// Runs due Brivano Assistant automations. Started every 15 minutes by the scheduler only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAiAllowance, recordAiMessage, serviceClient } from "../_shared/billing.ts";
import { AUTOMATION_TOOLS, runLoop, type Card, type Ctx, type Msg } from "../_shared/assistant.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function localNow(tz: string) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute), wd };
  } catch { return localNow("America/Chicago"); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = serviceClient();
  const { data: ok } = await db.rpc("verify_job_token", { p_name: "assistant_automations", p_token: req.headers.get("x-job-token") ?? "" });
  if (!ok) return json({ error: "Unauthorized" }, 401);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "not configured" }, 503);

  const { data: modelRow } = await db.from("ai_settings").select("setting_value").eq("setting_key", "claude_model").maybeSingle();
  const model = modelRow?.setting_value || "claude-sonnet-4-5";
  const { data: autos } = await db.from("automations").select("*").eq("enabled", true).limit(500);
  const summary = { due: 0, ran: 0, skipped: 0, failed: 0 };

  for (const a of autos ?? []) {
    const now = localNow(a.timezone);
    const [h, m] = String(a.run_time).split(":").map(Number);
    if (!(a.days as number[]).includes(now.wd) || now.minutes < h * 60 + m) continue;
    summary.due++;
    // One run per automation per local day: the unique key makes this safe to run twice.
    const { data: run, error: claimErr } = await db.from("automation_runs").insert({ automation_id: a.id, user_id: a.user_id, run_date: now.date }).select("id").single();
    if (claimErr) { summary.skipped++; continue; }

    const allowance = await getAiAllowance(a.user_id);
    if (allowance.used >= allowance.limit) {
      await db.from("automation_runs").update({ status: "failed", summary: "Skipped: this month's AI message limit is reached." }).eq("id", run.id);
      summary.failed++; continue;
    }
    const { data: thread } = await db.from("assistant_threads").insert({ user_id: a.user_id, title: `${a.name} · ${now.date}`, automation_id: a.id }).select("id").single();
    const save = async (msg: Msg, cards: Card[]) => {
      await db.from("assistant_messages").insert({ thread_id: thread.id, user_id: a.user_id, role: msg.role, content: msg.content, ui: cards });
    };
    const prompt = `Scheduled automation "${a.name}" (runs without the user present; actions are pre-approved; credit cap ${a.credit_cap} for this run; you cannot send messages or draft). Instructions:\n${a.instructions}\n\nDo the work with tools, then finish with a 1-2 sentence summary of what you did.`;
    const first: Msg = { role: "user", content: [{ type: "text", text: prompt }] };
    await save(first, []);
    const ctx: Ctx = { db, userId: a.user_id, tz: a.timezone, mode: "automation", capLeft: a.credit_cap, spent: 0, toolsUsed: [] };
    try {
      const r = await runLoop({ ctx, history: [first], apiKey, model, save, allowed: AUTOMATION_TOOLS });
      await recordAiMessage(a.user_id).catch(() => {});
      await db.from("automation_runs").update({ status: "done", credits_spent: ctx.spent, summary: (r.finalText || "Ran with nothing to report.").slice(0, 600), thread_id: thread.id }).eq("id", run.id);
      await db.from("automations").update({ last_run_at: new Date().toISOString() }).eq("id", a.id);
      await db.from("ai_usage_logs").insert({ user_id: a.user_id, task: "automation", model, input_tokens: r.tokensIn, output_tokens: r.tokensOut, success: true, tools: ctx.toolsUsed });
      summary.ran++;
    } catch (e) {
      console.error("automation failed", a.id, e);
      await db.from("automation_runs").update({ status: "failed", credits_spent: ctx.spent, summary: "The run couldn't finish. It will try again next scheduled day.", thread_id: thread.id }).eq("id", run.id);
      summary.failed++;
    }
  }
  return json(summary);
});
