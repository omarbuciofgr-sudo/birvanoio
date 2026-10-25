export type TrackedCall = { lead_id: string; created_at: string; call_date?: string | null; outcome?: string | null };

export function dateInTimeZone(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const trackedCallDate = (call: TrackedCall, timeZone: string) => call.call_date || dateInTimeZone(call.created_at, timeZone);

export function dailyCallSummary(calls: TrackedCall[], day: string, timeZone: string) {
  const daily = calls.filter((call) => trackedCallDate(call, timeZone) === day);
  return {
    calls: daily.length,
    leads: new Set(daily.map((call) => call.lead_id)).size,
    conversations: daily.filter((call) => call.outcome === "conversation").length,
    appointments: daily.filter((call) => call.outcome === "appointment_set").length,
  };
}

export function validateTrackedCall(callDate: string, today: string, followUpDate: string, doNotContact: boolean): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(callDate) || !Number.isFinite(Date.parse(`${callDate}T12:00:00Z`))) return "Choose a valid call date.";
  if (callDate > today) return "Call date cannot be in the future.";
  if (!doNotContact && followUpDate && followUpDate < callDate) return "Follow-up cannot be before the call.";
  return null;
}