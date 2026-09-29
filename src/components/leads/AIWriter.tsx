import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { writeWithAI, AIWritingError, type AIWritingTask } from "@/lib/ai/claudeWriter";

const TASK_LABELS: Record<AIWritingTask, string> = {
  call_script: "Call script",
  text_message: "Text message",
  email: "Email",
  talking_points: "Talking points",
  reply_suggestion: "Reply to owner",
  lead_summary: "Lead summary",
  market_report_summary: "Property summary",
};

interface AIWriterProps {
  leadId: string;
  title?: string;
  tasks?: AIWritingTask[];
  defaultTask?: AIWritingTask;
}

/** AI drafts land in an editable box. Nothing is ever sent from here. */
export const AIWriter = ({ leadId, title = "AI writing", tasks, defaultTask }: AIWriterProps) => {
  const options = tasks ?? (Object.keys(TASK_LABELS) as AIWritingTask[]);
  const [task, setTask] = useState<AIWritingTask>(defaultTask ?? options[0]);
  const [ownerMessage, setOwnerMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      setDraft(await writeWithAI(task, leadId, task === "reply_suggestion" ? ownerMessage : undefined));
      setLimitHit(false);
    } catch (e) {
      const err = e as AIWritingError;
      if (err.code === "ai_limit") setLimitHit(true);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="flex gap-2">
        {options.length > 1 && (
          <Select value={task} onValueChange={(v) => setTask(v as AIWritingTask)}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((t) => <SelectItem key={t} value={t}>{TASK_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={generate}
          disabled={loading || (task === "reply_suggestion" && !ownerMessage.trim())}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {loading ? "Writing..." : draft ? "Rewrite" : "Write draft"}
        </Button>
      </div>
      {task === "reply_suggestion" && (
        <Textarea value={ownerMessage} onChange={(e) => setOwnerMessage(e.target.value)}
          placeholder="Paste the owner's message here" className="min-h-[70px] text-xs" />
      )}
      {limitHit && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          You've used all AI writing for this month.{" "}
          <Link to="/billing" className="font-medium text-primary underline">Upgrade your plan</Link> for more.
        </div>
      )}
      {draft && (
        <div className="space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[160px] text-xs" />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">Draft only. Review and edit before you send.</p>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={copy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
