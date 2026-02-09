import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Clock, MessageSquare, Beaker } from "lucide-react";
import { toast } from "sonner";

interface CampaignOptimization {
  overall_score: number;
  timing_suggestions: string[];
  messaging_improvements: { step: number; current_issue: string; suggestion: string }[];
  audience_insights?: string[];
  ab_test_ideas?: { element: string; variant_a: string; variant_b: string }[];
  summary: string;
}

export const AICampaignOptimizer = ({ campaignId }: { campaignId: string }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CampaignOptimization | null>(null);

  const optimize = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-campaign-optimizer", {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      setData(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to optimize");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 px-5 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Campaign Optimizer
          </CardTitle>
          <Button onClick={optimize} disabled={loading} size="sm" variant="outline" className="text-xs gap-1.5">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {loading ? "Analyzing..." : "Optimize"}
          </Button>
        </div>
      </CardHeader>
      {data && (
        <CardContent className="px-5 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Score</p>
              <p className="text-lg font-bold">{data.overall_score}/100</p>
            </div>
            <Progress value={data.overall_score} className="flex-1 h-2" />
          </div>
          <p className="text-xs text-muted-foreground">{data.summary}</p>

          {data.timing_suggestions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Timing</p>
              {data.timing_suggestions.map((t, i) => <p key={i} className="text-xs text-muted-foreground pl-3">• {t}</p>)}
            </div>
          )}

          {data.messaging_improvements.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Messaging</p>
              {data.messaging_improvements.map((m, i) => (
                <div key={i} className="pl-3 mb-1.5">
                  <p className="text-xs"><Badge variant="outline" className="text-[9px] mr-1">Step {m.step}</Badge>{m.current_issue}</p>
                  <p className="text-xs text-primary">→ {m.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          {data.ab_test_ideas && data.ab_test_ideas.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1 flex items-center gap-1"><Beaker className="h-3 w-3" /> A/B Test Ideas</p>
              {data.ab_test_ideas.map((t, i) => (
                <div key={i} className="pl-3 mb-1 text-xs text-muted-foreground">
                  <span className="font-medium">{t.element}:</span> {t.variant_a} vs {t.variant_b}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
