import { supabase } from "@/integrations/supabase/client";
import { localDate, prettyDate } from "@/lib/followUps";

export type PlanChannel = "text" | "call" | "email";
export type PlanStep = { id?: string; day: number; channel: PlanChannel; instruction: string | null; market_report: boolean };
export type Plan = { id: string; kind: "fsbo" | "frbo" | "custom"; name: string; steps: PlanStep[] };
export type Enrollment = {
  id: string; lead_id: string; plan_name: string; steps: PlanStep[]; started_on: string;
  status: "active" | "completed" | "stopped"; stopped_reason: string | null;
};

const db = supabase as any;

export async function loadPlans(): Promise<Plan[]> {
  await db.rpc("ensure_default_follow_up_plans");
  const { data, error } = await db.from("follow_up_plans")
    .select("id, kind, name, follow_up_plan_steps(id, day, channel, instruction, market_report)")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id, kind: p.kind, name: p.name,
    steps: [...(p.follow_up_plan_steps ?? [])].sort((a: PlanStep, b: PlanStep) => a.day - b.day),
  }));
}

export async function savePlan(plan: Plan) {
  const { error: e1 } = await db.from("follow_up_plans").update({ name: plan.name.trim().slice(0, 120) || "Plan" }).eq("id", plan.id);
  if (e1) throw e1;
  const { error: e2 } = await db.from("follow_up_plan_steps").delete().eq("plan_id", plan.id);
  if (e2) throw e2;
  const rows = plan.steps.map((s) => ({
    plan_id: plan.id, day: Math.min(365, Math.max(1, Math.round(s.day))), channel: s.channel,
    instruction: s.instruction?.trim().slice(0, 500) || null, market_report: s.market_report,
  }));
  if (rows.length) {
    const { error } = await db.from("follow_up_plan_steps").insert(rows);
    if (error) throw error;
  }
}

export async function loadEnrollment(leadId: string): Promise<Enrollment | null> {
  const { data } = await db.from("lead_plan_enrollments")
    .select("id, lead_id, plan_name, steps, started_on, status, stopped_reason")
    .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as Enrollment) ?? null;
}

export async function startPlan(leadId: string, plan: Plan) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in.");
  if (!plan.steps.length) throw new Error("This plan has no steps yet.");
  const { error } = await db.from("lead_plan_enrollments").insert({
    user_id: auth.user.id, lead_id: leadId, plan_id: plan.id, plan_name: plan.name,
    steps: plan.steps.map(({ day, channel, instruction, market_report }) => ({ day, channel, instruction, market_report })),
    started_on: localDate(),
  });
  if (error) throw new Error(error.code === "23505" ? "This owner is already on a plan." : "Couldn't start the plan.");
  window.dispatchEvent(new Event("brivano:plans-changed"));
}

export async function stopPlan(enrollmentId: string) {
  await db.from("lead_follow_ups").delete().eq("enrollment_id", enrollmentId).is("done_at", null);
  const { error } = await db.from("lead_plan_enrollments")
    .update({ status: "stopped", stopped_reason: "Stopped by you", stopped_at: new Date().toISOString() }).eq("id", enrollmentId);
  if (error) throw new Error("Couldn't stop the plan.");
  window.dispatchEvent(new Event("brivano:plans-changed"));
}

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDate(d);
};

export const CHANNEL_LABEL: Record<PlanChannel, string> = { text: "text", call: "call", email: "email" };

/** "Step 3 of 7, next: call on Oct 12" */
export function planProgress(e: Enrollment, doneSteps: Set<number>) {
  const total = e.steps.length;
  const nextIdx = e.steps.findIndex((_, i) => !doneSteps.has(i));
  if (e.status !== "active" || nextIdx === -1) {
    return { total, current: total, label: e.status === "stopped" ? `Stopped: ${e.stopped_reason ?? "stopped"}` : "Plan finished" };
  }
  const s = e.steps[nextIdx];
  const due = addDays(e.started_on, s.day - 1);
  return { total, current: nextIdx + 1, label: `Step ${nextIdx + 1} of ${total}, next: ${CHANNEL_LABEL[s.channel]} on ${prettyDate(due)}` };
}
