import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Copy, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { splitEmailDraft } from "@/lib/ai/claudeWriter";
import { InsertBookingLink } from "@/components/booking/InsertBookingLink";
import type { AssistantCard } from "@/lib/assistant";

const money = (n: number | null, rent: boolean) => n == null ? "Price not listed" : `$${Number(n).toLocaleString("en-US")}${rent ? "/mo" : ""}`;

export function ConfirmCard({ card, busy, settled, onDecide }: { card: Extract<AssistantCard, { type: "confirm" }>; busy: boolean; settled: boolean; onDecide: (d: "confirm" | "cancel") => void }) {
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="text-sm font-medium">{card.summary}</p>
      <p className="mt-1 text-xs text-muted-foreground">{card.cost > 0 ? `Up to ${card.cost} credit${card.cost === 1 ? "" : "s"}` : "No credits"}</p>
      {!settled && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="min-h-11 gap-1 md:min-h-8" disabled={busy} onClick={() => onDecide("confirm")}><Check className="h-4 w-4" /> Confirm</Button>
          <Button size="sm" variant="outline" className="min-h-11 gap-1 md:min-h-8" disabled={busy} onClick={() => onDecide("cancel")}><X className="h-4 w-4" /> Cancel</Button>
        </div>
      )}
    </div>
  );
}

export function ResultCard({ card }: { card: Extract<AssistantCard, { type: "action_result" }> }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs ${card.ok ? "text-foreground" : "text-muted-foreground"}`}>
      {card.ok ? <Check className="mt-0.5 h-3.5 w-3.5 text-primary" /> : <X className="mt-0.5 h-3.5 w-3.5" />}
      <span>{card.cancelled ? "Cancelled: " : card.ok ? "Done: " : "Didn't work: "}{card.summary}{card.error ? `. ${card.error}` : ""}</span>
    </p>
  );
}

export function OwnersCard({ card }: { card: Extract<AssistantCard, { type: "owners" }> }) {
  return (
    <div className="space-y-1.5 rounded-lg border p-2">
      {card.owners.map((o) => (
        <Link key={o.listing_id} to={`/dashboard/owners/${encodeURIComponent(o.listing_id)}`} className="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
          <span className="min-w-0">
            <span className="block truncate font-medium">{o.address}</span>
            <span className="text-xs text-muted-foreground">{o.kind === "renting" ? "Renting" : "Selling"} · {money(o.price, o.kind === "renting")}</span>
          </span>
          {o.match_score >= 60 && <Badge variant="secondary" className="shrink-0">Best match</Badge>}
        </Link>
      ))}
    </div>
  );
}

export function DraftCard({ card }: { card: Extract<AssistantCard, { type: "draft" }> }) {
  const initial = card.channel === "email" ? splitEmailDraft(card.text) : { subject: "", body: card.text };
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const { data: l } = await supabase.from("leads").select("phone, email, do_not_contact").eq("id", card.lead_id).maybeSingle();
      if (!l) throw new Error("Lead not found.");
      if ((l as { do_not_contact?: boolean }).do_not_contact) throw new Error("This owner asked not to be contacted.");
      const { error } = card.channel === "text"
        ? await supabase.functions.invoke("send-sms", { body: { to: l.phone, message: body.trim(), leadId: card.lead_id } })
        : await supabase.functions.invoke("send-email", { body: { to: l.email, subject: subject.trim() || "Hello", body: body.trim(), leadId: card.lead_id } });
      if (error) {
        let msg = "Couldn't send right now. Please try again.";
        try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (typeof b?.error === "string") msg = b.error; } catch { /* keep */ }
        throw new Error(msg);
      }
      setSent(true);
      toast.success(card.channel === "text" ? "Text sent" : "Email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send right now.");
    } finally { setSending(false); }
  };

  const canSend = card.channel === "text" ? card.has_phone : card.channel === "email" ? card.has_email : false;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {card.channel === "call_script" ? "Call script" : card.channel === "email" ? "Email" : "Text"} for {card.lead_name}
      </p>
      {card.channel === "email" && <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={200} />}
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={card.channel === "text" ? 4 : 8} className="text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        {card.channel !== "call_script" && <InsertBookingLink value={body} onChange={setBody} />}
        <Button size="sm" variant="outline" className="min-h-11 gap-1 text-xs md:min-h-8" onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" /> Copy</Button>
        {card.channel !== "call_script" && (
          <Button size="sm" className="min-h-11 gap-1 text-xs md:min-h-8" disabled={!canSend || sending || sent || !body.trim()} onClick={send}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {sent ? "Sent" : "Send"}
          </Button>
        )}
      </div>
      {card.channel !== "call_script" && !canSend && (
        <p className="text-xs text-muted-foreground">No {card.channel === "text" ? "phone number" : "email"} yet. Get contact info first, then copy this draft.</p>
      )}
    </div>
  );
}

export function CreditsCard({ card }: { card: Extract<AssistantCard, { type: "credits" }> }) {
  return (
    <Link to="/dashboard/billing" className="inline-flex min-h-11 items-center text-xs text-primary underline md:min-h-0">
      {card.remaining != null ? `${card.remaining} credits left` : "See credits"} · Billing
    </Link>
  );
}
