import { supabase } from "@/integrations/supabase/client";

export type AIWritingTask =
  | "call_script"
  | "text_message"
  | "email"
  | "talking_points"
  | "reply_suggestion"
  | "lead_summary"
  | "market_report_summary";

export class AIWritingError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

const FALLBACK = "Something went wrong writing that. Please try again.";

/** Calls the server-side Claude writer. Never sends anything; returns draft text only. */
export async function writeWithAI(task: AIWritingTask, leadId: string, ownerMessage?: string): Promise<string> {
  return invokeWriter({ task, leadId, ownerMessage });
}

/** Talking points for an owner from Find Owners that hasn't been saved as a lead yet. */
export function writeTalkingPointsForListing(listingId: string): Promise<string> {
  return invokeWriter({ task: "talking_points", listingId });
}

async function invokeWriter(body: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke("claude-ai", { body });
  if (error) {
    let message = FALLBACK;
    let code: string | undefined;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error && typeof body.error === "string") message = body.error;
      code = body?.code;
    } catch { /* keep friendly fallback */ }
    throw new AIWritingError(message, code);
  }
  if (!data?.text) throw new AIWritingError(FALLBACK);
  return data.text as string;
}

/** Splits an AI email draft ("Subject: ...\n\nbody") into parts. */
export function splitEmailDraft(text: string): { subject: string; body: string } {
  const m = text.match(/^\s*Subject:\s*(.+)\n+([\s\S]*)$/i);
  return m ? { subject: m[1].trim(), body: m[2].trim() } : { subject: "", body: text.trim() };
}
