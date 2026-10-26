export const LEAD_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "appointment_set", label: "Appointment set" },
  { value: "listing_signed", label: "Listing signed" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
] as const;

export function nextPipelineFollowUp<T extends { lead_id: string; due_date: string; done_at: string | null }>(rows: T[], leadId: string) {
  return rows.filter((row) => row.lead_id === leadId && !row.done_at).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
}

export function latestPipelineCall<T extends { lead_id: string; call_date: string | null; created_at: string }>(rows: T[], leadId: string) {
  return rows.filter((row) => row.lead_id === leadId).sort((a, b) =>
    (b.call_date || b.created_at.slice(0, 10)).localeCompare(a.call_date || a.created_at.slice(0, 10)) || b.created_at.localeCompare(a.created_at)
  )[0];
}