import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowUp, History, Loader2, MessageSquarePlus, Workflow } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssistant } from "./AssistantContext";
import { ConfirmCard, CreditsCard, DraftCard, OwnersCard, ResultCard } from "./AssistantCards";
import { loadThread, loadThreads, streamAssistant, type AssistantCard, type ChatItem, type Thread } from "@/lib/assistant";

const STARTERS = [
  "Find new FSBOs in my city",
  "Who should I follow up with today?",
  "Write a text to the owner at [address]",
  "Set up a daily alert for Aurora rentals",
];

export function AssistantPanel() {
  const { open, close, prompt, clearPrompt } = useAssistant();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [showList, setShowList] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<{ message: string; limit?: boolean } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshThreads = useCallback(() => { loadThreads().then(setThreads).catch(() => {}); }, []);
  useEffect(() => { if (open) refreshThreads(); }, [open, refreshThreads]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [items]);
  useEffect(() => { if (open && !busy) setTimeout(() => inputRef.current?.focus(), 50); }, [open, busy, threadId]);

  const openThread = async (id: string) => {
    setShowList(false); setThreadId(id); setLoading(true); setError(null);
    try { const r = await loadThread(id); setItems(r.items); setSettled(r.settled); } finally { setLoading(false); }
  };
  const newChat = () => { setThreadId(null); setItems([]); setSettled(new Set()); setShowList(false); setError(null); };

  const run = async (body: Record<string, unknown>, userText?: string) => {
    setBusy(true); setError(null);
    const replyId = `a-${Date.now()}`;
    setItems((prev) => [...prev, ...(userText ? [{ id: `u-${Date.now()}`, role: "user" as const, text: userText, cards: [] }] : []), { id: replyId, role: "assistant", text: "", cards: [] }]);
    const patch = (fn: (m: ChatItem) => ChatItem) => setItems((prev) => prev.map((m) => (m.id === replyId ? fn(m) : m)));
    try {
      await streamAssistant(body, (e) => {
        if (e.type === "thread") setThreadId(e.thread_id);
        else if (e.type === "text") patch((m) => ({ ...m, text: m.text + e.text }));
        else if (e.type === "card") {
          if (e.card.type === "action_result") setSettled((s) => new Set(s).add(e.card.action_id as string));
          patch((m) => ({ ...m, cards: [...m.cards, e.card] }));
        } else if (e.type === "error") setError({ message: e.message });
      });
    } catch (e) {
      const err = e as Error & { limit?: boolean };
      setError({ message: err.message, limit: err.limit });
    } finally {
      setItems((prev) => prev.filter((m) => m.id !== replyId || m.text || m.cards.length));
      setBusy(false);
      refreshThreads();
    }
  };

  const sendText = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    // Any unanswered confirmation is cancelled by a new message.
    setSettled((s) => { const n = new Set(s); items.forEach((m) => m.cards.forEach((c) => c.type === "confirm" && n.add(c.action_id))); return n; });
    void run({ thread_id: threadId ?? undefined, message: t }, t);
  };

  useEffect(() => {
    if (open && prompt) { newChat(); setInput(prompt); clearPrompt(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prompt]);

  const decide = (actionId: string, decision: "confirm" | "cancel") => {
    if (!threadId || busy) return;
    setSettled((s) => new Set(s).add(actionId));
    void run({ thread_id: threadId, action_id: actionId, decision });
  };

  const renderCard = (c: AssistantCard, i: number) => {
    switch (c.type) {
      case "confirm": return <ConfirmCard key={i} card={c} busy={busy} settled={settled.has(c.action_id)} onDecide={(d) => decide(c.action_id, d)} />;
      case "action_result": return <ResultCard key={i} card={c} />;
      case "draft": return <DraftCard key={i} card={c} />;
      case "owners": return <OwnersCard key={i} card={c} />;
      case "credits": return <CreditsCard key={i} card={c} />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="right" className="flex h-[100dvh] w-full max-w-none flex-col gap-0 p-0 sm:max-w-md pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="flex-row items-center gap-1 space-y-0 border-b px-3 py-2 pr-12">
          {showList ? (
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setShowList(false)} aria-label="Back to chat"><ArrowLeft className="h-4 w-4" /></Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setShowList(true)} aria-label="Past chats"><History className="h-4 w-4" /></Button>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-sm">Brivano Assistant</SheetTitle>
            <SheetDescription className="text-[11px]">powered by Claude</SheetDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={newChat} aria-label="New chat"><MessageSquarePlus className="h-4 w-4" /></Button>
        </SheetHeader>

        {showList ? (
          <div className="flex-1 overflow-y-auto p-2">
            <Button asChild variant="outline" className="mb-2 min-h-11 w-full justify-start gap-2" onClick={close}>
              <Link to="/dashboard/automations"><Workflow className="h-4 w-4" /> Automations</Link>
            </Button>
            {threads.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No past chats yet.</p>}
            {threads.map((t) => (
              <button key={t.id} type="button" onClick={() => openThread(t.id)} className={`flex min-h-11 w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted ${t.id === threadId ? "bg-muted" : ""}`}>
                <span className="w-full truncate text-sm">{t.title}</span>
                <span className="text-[11px] text-muted-foreground">{t.automation_id ? "Automation · " : ""}{new Date(t.updated_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {loading && <div className="space-y-3"><Skeleton className="h-10 w-3/4" /><Skeleton className="ml-auto h-8 w-1/2" /><Skeleton className="h-16 w-full" /></div>}
              {!loading && items.length === 0 && (
                <div className="space-y-3 pt-6">
                  <p className="text-center text-sm text-muted-foreground">Ask me to find owners, check your follow-ups, or write a message.</p>
                  <div className="grid gap-2">
                    {STARTERS.map((s) => (
                      <Button key={s} variant="outline" className="min-h-11 justify-start whitespace-normal text-left text-sm font-normal" onClick={() => s.includes("[") ? (setInput(s), inputRef.current?.focus()) : sendText(s)}>{s}</Button>
                    ))}
                  </div>
                </div>
              )}
              {items.map((m) => m.role === "user" ? (
                <div key={m.id} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">{m.text}</div>
              ) : (
                <div key={m.id} className="space-y-2">
                  {m.text && <div className="prose prose-sm max-w-none text-sm dark:prose-invert"><ReactMarkdown>{m.text}</ReactMarkdown></div>}
                  {m.cards.map(renderCard)}
                </div>
              ))}
              {busy && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…</p>}
              {error && <p className="text-sm text-destructive">{error.message} {error.limit && <Link to="/dashboard/billing" className="underline" onClick={close}>Upgrade</Link>}</p>}
              <div ref={endRef} />
            </div>
            <form className="flex items-end gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); sendText(input); }}>
              <Textarea
                ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={4000}
                placeholder="Ask Brivano Assistant…" className="max-h-32 min-h-11 resize-none text-base md:text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); } }}
              />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={busy || !input.trim()} aria-label="Send"><ArrowUp className="h-4 w-4" /></Button>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function AskAssistantButton({ className = "", label = "Ask Brivano Assistant" }: { className?: string; label?: string }) {
  const { openAssistant } = useAssistant();
  return (
    <Button variant="outline" size="sm" className={`gap-1.5 text-xs ${className}`} onClick={() => openAssistant()}>
      <img src="/favicon.png" alt="" className="hidden" />
      <MessageSquarePlus className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}
