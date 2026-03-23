import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, AlertTriangle, DollarSign, Target } from "lucide-react";
import { toast } from "sonner";

interface ForecastData {
  win_probability: number;
  projected_revenue: string;
  forecast_confidence: number;
  pipeline_health: "strong" | "moderate" | "weak";
  insights: { insight: string; impact: string }[];
  at_risk_deals: number;
  recommendations: string[];
}

const healthColors = { strong: "text-green-500 bg-green-500/10", moderate: "text-yellow-500 bg-yellow-500/10", weak: "text-red-500 bg-red-500/10" };

export const AIDealForecast = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ForecastData | null>(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-deal-forecast");
      if (error) throw error;
      setData(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to forecast");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 px-5 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> AI Deal Forecast
          </CardTitle>
          <Button onClick={analyze} disabled={loading} size="sm" variant="outline" className="text-xs gap-1.5">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3" />}
            {loading ? "Analyzing..." : data ? "Refresh" : "Forecast"}
          </Button>
        </div>
      </CardHeader>
      {data && (
        <CardContent className="px-5 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Win Probability</p>
              <p className="text-lg font-bold">{data.win_probability}%</p>
              <Progress value={data.win_probability} className="h-1 mt-1" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Projected Revenue</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{data.projected_revenue}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">At Risk</p>
              <p className="text-lg font-bold text-destructive">{data.at_risk_deals}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] ${healthColors[data.pipeline_health]}`}>{data.pipeline_health} pipeline</Badge>
            <span className="text-[10px] text-muted-foreground">{data.forecast_confidence}% confidence</span>
          </div>
          {data.insights.length > 0 && (
            <div className="space-y-1">
              {data.insights.slice(0, 3).map((i, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className="text-[9px] shrink-0">{i.impact}</Badge>
                  <span className="text-muted-foreground">{i.insight}</span>
                </div>
              ))}
            </div>
          )}
          {data.recommendations.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1">Recommendations</p>
              {data.recommendations.slice(0, 3).map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-3">• {r}</p>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
