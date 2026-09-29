import { supabase } from "@/integrations/supabase/client";

/** Local calendar date as YYYY-MM-DD. */
export const localDate = (d: Date = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDate(d);
};

export const nextWeek = () => daysFromNow(7);

export const prettyDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export async function addFollowUp(leadId: string, dueDate: string, note?: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };
  const { error } = await (supabase as any).from("lead_follow_ups").insert({
    user_id: auth.user.id,
    lead_id: leadId,
    due_date: dueDate,
    note: note?.trim() ? note.trim().slice(0, 1000) : null,
  });
  return { error: error ? "Couldn't save the follow-up. Please try again." : null };
}

export async function markFollowUpDone(id: string) {
  const { error } = await (supabase as any).from("lead_follow_ups").update({ done_at: new Date().toISOString() }).eq("id", id);
  return { error: error ? "Couldn't update the follow-up." : null };
}
