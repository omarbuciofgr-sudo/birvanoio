import { supabase } from "@/integrations/supabase/client";
import { resolveSupabaseUrl } from "@/integrations/supabase/constants";

export type AssistantCard =
  | { type: "confirm"; action_id: string; summary: string; cost: number }
  | { type: "action_result"; action_id: string; summary: string; ok: boolean; cancelled?: boolean; error?: string | null }
  | { type: "draft"; lead_id: string; lead_name: string; channel: "text" | "email" | "call_script"; text: string; has_phone: boolean; has_email: boolean }
  | { type: "owners"; city: string; owners: { listing_id: string; address: string; kind: string; price: number | null; match_score: number }[] }
  | { type: "credits"; remaining: number | null };

export type ChatItem = { id: string; role: "user" | "assistant"; text: string; cards: AssistantCard[] };
export type Thread = { id: string; title: string; updated_at: string; automation_id: string | null };

type Block = { type: string; text?: string };

export async function loadThreads(): Promise<Thread[]> {
  const { data } = await (supabase as any).from("assistant_threads").select("id, title, updated_at, automation_id").order("updated_at", { ascending: false }).limit(50);
  return data ?? [];
}

/** Rebuilds the visible chat from stored Claude messages (tool plumbing is hidden). */
export async function loadThread(threadId: string): Promise<{ items: ChatItem[]; settled: Set<string> }> {
  const db = supabase as any;
  const [{ data: rows }, { data: acts }] = await Promise.all([
    db.from("assistant_messages").select("id, role, content, ui").eq("thread_id", threadId).order("created_at"),
    db.from("assistant_pending_actions").select("id, status").eq("thread_id", threadId),
  ]);
  const settled = new Set<string>((acts ?? []).filter((a: { status: string }) => a.status !== "pending").map((a: { id: string }) => a.id));
  const items: ChatItem[] = [];
  for (const r of rows ?? []) {
    const text = ((r.content ?? []) as Block[]).filter((b) => b.type === "text").map((b) => b.text).join("");
    const cards = (r.ui ?? []) as AssistantCard[];
    if (r.role === "assistant") {
      const last = items[items.length - 1];
      // Consecutive assistant rounds read as one reply.
      if (last?.role === "assistant") { last.text = [last.text, text].filter(Boolean).join("\n\n"); last.cards.push(...cards); continue; }
      items.push({ id: r.id, role: "assistant", text, cards: [...cards] });
    } else {
      if (cards.length) {
        const last = items[items.length - 1];
        if (last?.role === "assistant") last.cards.push(...cards);
        else items.push({ id: `${r.id}-c`, role: "assistant", text: "", cards: [...cards] });
      }
      if (text) items.push({ id: r.id, role: "user", text, cards: [] });
    }
  }
  return { items, settled };
}

export type StreamEvent =
  | { type: "thread"; thread_id: string }
  | { type: "text"; text: string }
  | { type: "card"; card: AssistantCard }
  | { type: "error"; message: string }
  | { type: "done" };

export async function streamAssistant(body: Record<string, unknown>, onEvent: (e: StreamEvent) => void) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in.");
  const res = await fetch(`${resolveSupabaseUrl()}/functions/v1/assistant-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const b = await res.json().catch(() => ({}));
    const err = new Error(typeof b.error === "string" ? b.error : "The assistant is unavailable right now.") as Error & { limit?: boolean };
    err.limit = b.code === "ai_limit";
    throw err;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, i).trim();
      buf = buf.slice(i + 2);
      if (!chunk.startsWith("data:")) continue;
      try { onEvent(JSON.parse(chunk.slice(5))); } catch { /* ignore partial */ }
    }
  }
}
