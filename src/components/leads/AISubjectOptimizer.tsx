import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Suggestion {
  subject: string;
  predicted_open_rate: number;
  strategy: string;
  style: string;
}

export const AISubjectOptimizer = ({ onSelect }: { onSelect?: (subject: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const optimize = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-subject-optimizer", {
        body: { subject, context: "Sales outreach email" },
      });
      if (error) throw error;
      setSuggestions(data?.suggestions || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to optimize");
    } finally {
      setLoading(false);
    }
  };

  const copy = (idx: number) => {
    navigator.clipboard.writeText(suggestions[idx].subject);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    if (onSelect) onSelect(suggestions[idx].subject);
    toast.success("Copied!");
  };

  const styleColors: Record<string, string> = {
    curiosity: "bg-purple-500/10 text-purple-400",
    urgency: "bg-red-500/10 text-red-400",
    value: "bg-green-500/10 text-green-400",
    personalized: "bg-blue-500/10 text-blue-400",
    question: "bg-yellow-500/10 text-yellow-400",
    social_proof: "bg-pink-500/10 text-pink-400",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">AI Subject Line Optimizer</span>
      </div>
      <div className="flex gap-2">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter your subject line..." className="text-sm h-9" />
        <Button onClick={optimize} disabled={loading} size="sm" className="gap-1.5 shrink-0">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Optimize
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-secondary/30 border border-border/50 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium flex-1">{s.subject}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copy(i)}>
                  {copiedIdx === i ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[9px] ${styleColors[s.style] || "bg-muted"}`}>{s.style}</Badge>
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-[10px] text-muted-foreground">{s.predicted_open_rate}%</span>
                  <Progress value={s.predicted_open_rate} className="h-1 flex-1" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{s.strategy}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
