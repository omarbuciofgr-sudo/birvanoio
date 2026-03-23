import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface QualificationResult {
  qualification: "hot" | "warm" | "cold";
  confidence: number;
  reasoning: string;
  buying_signals: string[];
  risk_factors: string[];
  next_actions: string[];
}

interface AIQualifyPanelProps {
  lead: {
    id: string;
    business_name: string;
    contact_name?: string | null;
    industry?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    city?: string | null;
    state?: string | null;
    company_size?: string | null;
    lead_score?: number | null;
    status: string;
  };
}

const qualColors = {
  hot: "bg-red-500/20 text-red-400 border-red-500/30",
  warm: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  cold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export const AIQualifyPanel = ({ lead }: AIQualifyPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QualificationResult | null>(null);

  const qualify = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-qualify-lead", {
        body: { lead },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to qualify lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">AI Qualification</h3>
        </div>
        <Button onClick={qualify} disabled={loading} size="sm" variant="outline" className="gap-1.5">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
          {loading ? "Analyzing..." : result ? "Re-analyze" : "Qualify"}
        </Button>
      </div>

      {result && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <Badge className={`${qualColors[result.qualification]} text-sm px-3 py-1 uppercase font-bold`}>
              {result.qualification}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(result.confidence * 100)}% confidence
            </span>
          </div>

          <p className="text-sm text-muted-foreground">{result.reasoning}</p>

          {result.buying_signals.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-foreground">Buying Signals</span>
              </div>
              <ul className="space-y-0.5">
                {result.buying_signals.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground pl-5">• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {result.risk_factors.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-foreground">Risk Factors</span>
              </div>
              <ul className="space-y-0.5">
                {result.risk_factors.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground pl-5">• {r}</li>
                ))}
              </ul>
            </div>
          )}

          {result.next_actions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowRight className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">Recommended Actions</span>
              </div>
              <ul className="space-y-0.5">
                {result.next_actions.map((a, i) => (
                  <li key={i} className="text-xs text-muted-foreground pl-5">• {a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
