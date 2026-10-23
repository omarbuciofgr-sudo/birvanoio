import { callScripts, textTemplates, voicemails, type CallScript, type LeadType, type PlaybookRole, type TokenKey } from "../data/playbookContent";

export const PLAYBOOK_ROLES: PlaybookRole[] = ["agent", "investor", "leasing_agent", "property_manager"];

/** Only stage directions are cues; bracketed fill-in values remain spoken/copyable. */
export function scriptParts(text: string): { text: string; cue: boolean }[] {
  return text.split(/(\[[^\]\n]+\])/g).filter(Boolean).map((part) => ({
    text: part,
    cue: /^\[(?:They\b|If\b|Repeat\b|Listen\b)/i.test(part),
  }));
}

export function spokenScriptText(text: string): string {
  return scriptParts(text).filter((part) => !part.cue).map((part) => part.text).join("")
    .replace(/[^\S\n]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export const asPlaybookRole = (v?: string | null): PlaybookRole | null =>
  PLAYBOOK_ROLES.includes(v as PlaybookRole) ? (v as PlaybookRole) : null;

/** Maps the stored lowercase leads.listing_type to the playbook's FSBO/FRBO. */
export const toLeadType = (v?: string | null): LeadType | null =>
  v === "fsbo" ? "FSBO" : v === "frbo" ? "FRBO" : null;

/** Scripts that match a lead type (or all types when unknown) and role, role matches first. */
export function scriptsFor(leadType: LeadType | null, role: PlaybookRole | null, showAll = false): CallScript[] {
  const byType = leadType ? callScripts.filter((s) => s.leadType === leadType) : callScripts;
  if (!role) return byType;
  const matching = byType.filter((s) => s.roles.includes(role));
  if (!showAll) return matching.length ? matching : byType;
  return [...matching, ...byType.filter((s) => !s.roles.includes(role))];
}

export const isRoleMatch = (s: CallScript, role: PlaybookRole | null) => !!role && s.roles.includes(role);

export const textsFor = (leadType: LeadType | null) =>
  textTemplates.filter((t) => !leadType || !t.leadType || t.leadType === leadType);

export const voicemailsFor = (leadType: LeadType | null) =>
  (leadType ? [leadType] : (["FSBO", "FRBO"] as LeadType[])).map((t) => ({ type: t, text: voicemails[t] }));

export type TokenLead = { contact_name?: string | null; business_name?: string | null; city?: string | null };
export type TokenProfile = {
  first_name?: string | null; last_name?: string | null; brokerage?: string | null;
  company_name?: string | null; phone?: string | null; home_market?: string | null;
};

export function tokenValues(lead: TokenLead | null, profile: TokenProfile | null): Partial<Record<TokenKey, string>> {
  const firstOwner = lead?.contact_name?.trim().split(/\s+/)[0];
  const homeCity = profile?.home_market?.split(",")[0]?.trim();
  return {
    ownerName: firstOwner || "there",
    street: lead?.business_name?.split(",")[0]?.trim() || undefined,
    area: lead?.city?.trim() || homeCity || undefined,
    yourName: [profile?.first_name, profile?.last_name].filter((p) => p?.trim()).join(" ") || undefined,
    company: profile?.brokerage?.trim() || profile?.company_name?.trim() || undefined,
    phone: profile?.phone?.trim() || undefined,
  };
}

export type CallOutcome = "no_answer" | "voicemail" | "conversation" | "not_interested" | "appointment_set" | "do_not_call";

export const OUTCOMES: { key: CallOutcome; label: string; followUpDays: number | null }[] = [
  { key: "no_answer", label: "No answer", followUpDays: 2 },
  { key: "voicemail", label: "Voicemail", followUpDays: 2 },
  { key: "conversation", label: "Conversation", followUpDays: 7 },
  { key: "not_interested", label: "Not interested", followUpDays: 30 },
  { key: "appointment_set", label: "Appointment set", followUpDays: 1 },
  { key: "do_not_call", label: "Do not call", followUpDays: null },
];

/** What an outcome does to the lead. Every outcome counts toward the daily contacted goal. */
export function outcomeEffects(outcome: CallOutcome) {
  return {
    countsAsContacted: true,
    markDoNotContact: outcome === "do_not_call",
    setStatus: outcome === "appointment_set" ? ("appointment_set" as const) : null,
    allowFollowUp: outcome !== "do_not_call",
  };
}

/** Call/Text actions are hidden for owners marked do not contact. */
export const canCallOrText = (lead: { do_not_contact?: boolean | null } | null | undefined) => !lead?.do_not_contact;
