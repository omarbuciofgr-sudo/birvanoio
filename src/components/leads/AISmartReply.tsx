import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Reply {
  label: string;
  tone: string;
  subject?: string;
  body: string;
}

interface AISmartReplyProps {
  lead: { id?: string; business_name: string; contact_name?: string | null; industry?: string | null };
  channel?: string;
  onSelect?: (body: string, subject?: string) => void;
}

const toneColors: Record<string, string> = { friendly: "bg-green-500/10 text-green-400", professional: "bg-blue-500/10 text-blue-400", direct: "bg-orange-500/10 text-orange-400", empathetic: "bg-purple-500/10 text-purple-400" };

export const AISmartReply = ({ lead, channel = "email", onSelect }: AISmartReplyProps) => {
  const [loading, setLoading] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-smart-reply", {
        body: { lead, channel },
      });
      if (error) throw error;
      setReplies(data?.replies || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate replies");
    } finally {
      setLoading(false);
    }
  };

  const useReply = (idx: number) => {
    const r = replies[idx];
    navigator.clipboard.writeText(r.body);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    if (onSelect) onSelect(r.body, r.subject);
    toast.success("Reply copied!");
  };

  return (
    <div className="space-y-2">
      <Button onClick={generate} disabled={loading} size="sm" variant="outline" className="gap-1.5 text-xs w-full">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
        {loading ? "Generating..." : "AI Smart Reply"}
      </Button>
      {replies.length > 0 && (
        <div className="space-y-2">
          {replies.map((r, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-secondary/30 border border-border/50 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => useReply(i)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{r.label}</span>
                <div className="flex items-center gap-1.5">
                  <Badge className={`text-[9px] ${toneColors[r.tone] || "bg-muted"}`}>{r.tone}</Badge>
                  {copiedIdx === i ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
              {r.subject && <p className="text-[10px] text-foreground mb-0.5">Subject: {r.subject}</p>}
              <p className="text-[10px] text-muted-foreground line-clamp-3">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
