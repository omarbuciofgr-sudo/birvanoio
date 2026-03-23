import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, Info } from "lucide-react";
import { toast } from "sonner";

interface Anomaly {
  metric: string;
  severity: string;
  description: string;
  expected_value?: string;
  actual_value?: string;
  recommendation: string;
}

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-red-500 bg-red-500/10 border-red-500/30" },
  warning: { icon: Info, color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" },
  info: { icon: Info, color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
};
const healthConfig = { healthy: "text-green-500", needs_attention: "text-yellow-500", critical: "text-red-500" };

export const AIAnomalyDetection = () => {
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [health, setHealth] = useState("");
  const [summary, setSummary] = useState("");

  const scan = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-anomaly-detection");
      if (error) throw error;
      setAnomalies(data?.anomalies || []);
      setHealth(data?.overall_health || "");
      setSummary(data?.summary || "");
    } catch (e: any) {
      toast.error(e.message || "Failed to detect anomalies");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 px-5 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-primary" /> AI Anomaly Detection
          </CardTitle>
          <Button onClick={scan} disabled={loading} size="sm" variant="outline" className="text-xs gap-1.5">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}
            {loading ? "Scanning..." : anomalies.length ? "Re-scan" : "Scan Metrics"}
          </Button>
        </div>
      </CardHeader>
      {(anomalies.length > 0 || summary) && (
        <CardContent className="px-5 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            {health && (
              <div className="flex items-center gap-1">
                {health === "healthy" ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <AlertCircle className={`h-3.5 w-3.5 ${healthConfig[health as keyof typeof healthConfig] || ""}`} />}
                <span className={`text-xs font-medium capitalize ${healthConfig[health as keyof typeof healthConfig] || ""}`}>{health.replace("_", " ")}</span>
              </div>
            )}
            <Badge variant="outline" className="text-[10px]">{anomalies.length} findings</Badge>
          </div>
          {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
          <div className="space-y-2">
            {anomalies.map((a, i) => {
              const config = severityConfig[a.severity as keyof typeof severityConfig] || severityConfig.info;
              return (
                <div key={i} className={`p-2.5 rounded-lg border ${config.color}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-[9px] ${config.color}`}>{a.severity}</Badge>
                    <span className="text-xs font-medium">{a.metric}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{a.description}</p>
                  {(a.expected_value || a.actual_value) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Expected: {a.expected_value || 'N/A'} → Actual: {a.actual_value || 'N/A'}</p>
                  )}
                  <p className="text-[10px] text-primary mt-1">→ {a.recommendation}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
