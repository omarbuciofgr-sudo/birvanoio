import { supabase } from "@/integrations/supabase/client";
import { addFollowUp } from "@/lib/followUps";
import { OUTCOMES, outcomeEffects, type CallOutcome } from "@/lib/playbook";

export type GoalSettings = { contactGoal: number; followupGoal: number; weekendsCount: boolean };
export type GoalDay = { day: string; contacted: number; followups: number };

export const DEFAULT_GOALS: GoalSettings = { contactGoal: 10, followupGoal: 5, weekendsCount: false };
export const browserTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago"; } catch { return "America/Chicago"; }
};

export const GOALS_CHANGED = "brivano:goals-changed";
export const notifyGoalsChanged = () => window.dispatchEvent(new Event(GOALS_CHANGED));

export async function loadGoalSettings(userId: string): Promise<GoalSettings> {
  const { data } = await (supabase as any).from("profiles")
    .select("daily_contact_goal, daily_followup_goal, streak_counts_weekends, timezone")
    .eq("user_id", userId).maybeSingle();
  const tz = browserTimeZone();
  // Keep the saved time zone current so the morning email counts the same days.
  if (data && data.timezone !== tz) await (supabase as any).from("profiles").update({ timezone: tz }).eq("user_id", userId);
  return {
    contactGoal: data?.daily_contact_goal ?? DEFAULT_GOALS.contactGoal,
    followupGoal: data?.daily_followup_goal ?? DEFAULT_GOALS.followupGoal,
    weekendsCount: data?.streak_counts_weekends ?? DEFAULT_GOALS.weekendsCount,
  };
}

export async function loadGoalDays(days = 90): Promise<GoalDay[]> {
  const { data, error } = await (supabase as any).rpc("my_goal_day_counts", { p_tz: browserTimeZone(), p_days: days });
  if (error) throw error;
  return (data ?? []) as GoalDay[];
}

const isWeekend = (ymd: string) => { const d = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return d === 0 || d === 6; };

/** Consecutive days meeting both goals, ending today (or yesterday if today isn't done yet). Weekends are skipped unless they count. */
export function computeStreak(days: GoalDay[], g: GoalSettings): number {
  const met = (d: GoalDay) => d.contacted >= g.contactGoal && d.followups >= g.followupGoal;
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    const isToday = i === days.length - 1;
    if (met(d)) { streak++; continue; }
    if (isToday) continue; // today still in progress
    if (!g.weekendsCount && isWeekend(d.day)) continue;
    break;
  }
  return streak;
}

/** Logs a call outcome. Every outcome (including No answer) counts toward the contacted goal. */
export async function logCallOutcome(leadId: string, outcome: CallOutcome, opts: { note?: string; followUpDate?: string | null } = {}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };
  const fx = outcomeEffects(outcome);
  const label = OUTCOMES.find((o) => o.key === outcome)?.label ?? outcome;
  const note = opts.note?.trim().slice(0, 500);
  const { error } = await supabase.from("conversation_logs").insert({
    client_id: auth.user.id, lead_id: leadId, type: "call", direction: "outbound", outcome,
    content: note ? `Call outcome: ${label}. ${note}` : `Call outcome: ${label}`,
  });
  if (error) return { error: "Couldn't log the call. Please try again." };
  if (fx.markDoNotContact) {
    const { error: e } = await supabase.from("leads").update({
      do_not_contact: true, do_not_contact_at: new Date().toISOString(), do_not_contact_reason: "Asked not to be called",
    }).eq("id", leadId);
    if (e) return { error: "Call logged, but couldn't mark do not contact. Please try again." };
  }
  if (fx.setStatus) await supabase.from("leads").update({ status: fx.setStatus }).eq("id", leadId);
  if (fx.allowFollowUp && opts.followUpDate) {
    const { error: e } = await addFollowUp(leadId, opts.followUpDate, note ? `${label}: ${note}` : label);
    if (e) return { error: e };
  }
  notifyGoalsChanged();
  return { error: null };
}

export async function logOutsideContact(leadId: string, note?: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };
  const { error } = await supabase.from("conversation_logs").insert({
    client_id: auth.user.id, lead_id: leadId, type: "call", direction: "outbound",
    content: note?.trim() ? `Outside contact: ${note.trim().slice(0, 500)}` : "Outside contact (logged manually)",
  });
  if (error) return { error: "Couldn't log the contact. Please try again." };
  notifyGoalsChanged();
  return { error: null };
}
