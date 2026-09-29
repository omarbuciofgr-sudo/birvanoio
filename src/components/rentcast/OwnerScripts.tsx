import { InsertBookingLink } from "@/components/booking/InsertBookingLink";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Copy, Loader2, Mail, MessageSquare, Phone, RefreshCw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AIWritingError, splitEmailDraft, writeForOwner, type AITone, type AIWritingTask } from "@/lib/ai/claudeWriter";
import { useCommunicationCompliance } from "@/hooks/useCommunicationCompliance";
import { addFollowUp, daysFromNow, prettyDate } from "@/lib/followUps";

type Kind = "call" | "text" | "email";
const TASK: Record<Kind, AIWritingTask> = { call: "call_script", text: "text_message", email: "email" };

interface Props {
  selling: boolean;
  leadId: string | null;
  listingId: string | null;
  phone: string | null;
  email: string | null;
}

export function OwnerScripts({ selling, leadId, listingId, phone, email }: Props) {
  const tag = selling ? "FSBO" : "FRBO";
  const [kind, setKind] = useState<Kind | null>(null);
  const [tone, setTone] = useState<AITone>("friendly");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [writing, setWriting] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<{ message: string; limit: boolean } | null>(null);
  const { requireAcceptance, complianceDialog } = useCommunicationCompliance();

  const generate = async (k: Kind, t: AITone = tone) => {
    setKind(k);
    setWriting(true);
    setErr(null);
    try {
      const out = await writeForOwner(TASK[k], { leadId, listingId }, t);
      if (k === "email") {
        const parts = splitEmailDraft(out);
        setSubject(parts.subject);
        setText(parts.body);
      } else {
        setSubject("");
        setText(out);
      }
    } catch (e) {
      const x = e instanceof AIWritingError ? e : new AIWritingError("Something went wrong writing that. Please try again.");
      setErr({ message: x.message, limit: x.code === "ai_limit" });
    } finally {
      setWriting(false);
    }
  };

  const afterSend = (what: string) => {
    const due = daysFromNow(3);
    toast.success(what, {
      description: `Follow up on ${prettyDate(due)}?`,
      duration: 10000,
      action: { label: "Set follow-up", onClick: async () => { const r = await addFollowUp(leadId!, due); r.error ? toast.error(r.error) : toast.success(`Follow-up set for ${prettyDate(due)}`); } },
    });
  };

  const sendNow = async () => {
    if (!leadId || !text.trim()) return;
    setSending(true);
    try {
      const { error } = kind === "text"
        ? await supabase.functions.invoke("send-sms", { body: { to: phone, message: text.trim(), leadId } })
        : await supabase.functions.invoke("send-email", { body: { to: email, subject: subject.trim() || "Hello", body: text.trim(), leadId } });
      if (error) {
        let msg = "Couldn't send right now. Please try again.";
        try { const b = await (error as any).context?.json?.(); if (typeof b?.error === "string") msg = b.error; } catch { /* keep */ }
        throw new Error(msg);
      }
      afterSend(kind === "text" ? "Text sent · 1 credit used" : "Email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send right now.");
    } finally {
      setSending(false);
    }
  };

  const onSend = () => (kind === "text" ? requireAcceptance(() => { void sendNow(); }) : void sendNow());

  const sendBlock = (() => {
    if (kind === "call" || !kind) return null;
    if (!leadId) return "Save this owner to My Leads to send from the app.";
    if (kind === "text" && !phone) return "No phone number yet. Get contact info first.";
    if (kind === "email" && !email) return "No email yet. Get contact info first.";
    return null;
  })();

  const btn = (k: Kind, label: string, Icon: typeof Phone) => (
    <Button size="sm" variant={kind === k ? "default" : "outline"} disabled={writing} onClick={() => generate(k)} className="gap-1.5">
      <Icon className="h-4 w-4" /> {tag} {label}
    </Button>
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {btn("call", "call script", Phone)}
            {btn("text", "text message", MessageSquare)}
            {btn("email", "email", Mail)}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Tone
            <ToggleGroup type="single" size="sm" value={tone} onValueChange={(v) => v && setTone(v as AITone)}>
              <ToggleGroupItem value="friendly" className="h-8 text-xs px-2.5">Friendly</ToggleGroupItem>
              <ToggleGroupItem value="direct" className="h-8 text-xs px-2.5">Direct</ToggleGroupItem>
              <ToggleGroupItem value="brief" className="h-8 text-xs px-2.5">Brief</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {!kind && <p className="text-sm text-muted-foreground">Pick a script type. Claude writes a draft for this {selling ? "seller" : "landlord"} that you can edit before using it.</p>}

        {err && (
          <p className="text-sm text-destructive">
            {err.message} {err.limit && <Link to="/dashboard/billing" className="underline">Upgrade</Link>}
          </p>
        )}

        {kind && (writing ? (
          <div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-48 w-full" /></div>
        ) : text || subject ? (
          <div className="space-y-2">
            {kind === "email" && <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={200} />}
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={kind === "text" ? 5 : 12} className="text-sm" />
            <div className="flex flex-wrap items-center gap-2">
              {kind !== "call" && <InsertBookingLink value={text} onChange={setText} />}
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(kind === "email" && subject ? `Subject: ${subject}\n\n${text}` : text); toast.success("Copied"); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => generate(kind)} disabled={writing}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
              </Button>
              {kind !== "call" && (
                <Button size="sm" onClick={onSend} disabled={sending || !!sendBlock || !text.trim()}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Send {kind === "text" ? "text" : "email"}
                </Button>
              )}
              {sendBlock && <span className="text-xs text-muted-foreground">{sendBlock}</span>}
            </div>
          </div>
        ) : null)}
        {complianceDialog}
      </CardContent>
    </Card>
  );
}
