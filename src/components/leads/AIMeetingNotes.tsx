import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface MeetingSummary {
  executive_summary: string;
  key_points: string[];
  action_items: { task: string; owner: string; deadline?: string; priority: string }[];
  decisions_made?: string[];
  follow_up_date?: string;
  sentiment: string;
  deal_progress: string;
  next_steps: string[];
}

interface AIMeetingNotesProps {
  lead: { id: string; business_name: string; contact_name?: string | null };
}

const sentimentColors: Record<string, string> = { very_positive: "text-green-500", positive: "text-green-400", neutral: "text-muted-foreground", negative: "text-orange-400", very_negative: "text-red-500" };
const progressColors: Record<string, string> = { advancing: "bg-green-500/10 text-green-500", stalled: "bg-yellow-500/10 text-yellow-500", at_risk: "bg-red-500/10 text-red-500", closed: "bg-blue-500/10 text-blue-500" };

export const AIMeetingNotes = ({ lead }: AIMeetingNotesProps) => {
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState<MeetingSummary | null>(null);

  const summarize = async () => {
    if (!transcript.trim()) { toast.error("Enter call notes or transcript"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-meeting-notes", {
        body: { transcript, lead },
      });
      if (error) throw error;
      setSummary(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to summarize");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">AI Meeting Notes</span>
      </div>
      <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste call transcript or meeting notes..." className="text-sm min-h-[80px]" />
      <Button onClick={summarize} disabled={loading} size="sm" className="w-full gap-1.5">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
        {loading ? "Summarizing..." : "Summarize Meeting"}
      </Button>

      {summary && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Badge className={progressColors[summary.deal_progress] || "bg-muted"}>{summary.deal_progress}</Badge>
            <span className={`text-xs capitalize ${sentimentColors[summary.sentiment] || ""}`}>{summary.sentiment.replace("_", " ")}</span>
            {summary.follow_up_date && <Badge variant="outline" className="text-[9px]">Follow-up: {summary.follow_up_date}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{summary.executive_summary}</p>

          <div>
            <p className="text-[10px] font-medium text-foreground mb-1">Key Points</p>
            {summary.key_points.map((p, i) => <p key={i} className="text-xs text-muted-foreground pl-3">• {p}</p>)}
          </div>

          {summary.action_items.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Action Items</p>
              {summary.action_items.map((a, i) => (
                <div key={i} className="flex items-start gap-2 pl-3 mb-1">
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${a.priority === 'high' ? 'border-red-500/30 text-red-400' : a.priority === 'medium' ? 'border-yellow-500/30 text-yellow-400' : ''}`}>{a.priority}</Badge>
                  <div>
                    <p className="text-xs">{a.task}</p>
                    <p className="text-[10px] text-muted-foreground">{a.owner}{a.deadline ? ` · by ${a.deadline}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {summary.next_steps.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Next Steps</p>
              {summary.next_steps.map((s, i) => <p key={i} className="text-xs text-muted-foreground pl-3">{i + 1}. {s}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
