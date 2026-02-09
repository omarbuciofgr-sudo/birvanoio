import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface AtRiskLead {
  lead_id: string;
  business_name: string;
  risk_level: string;
  days_inactive: number;
  risk_reason: string;
  save_action: string;
}

const riskColors = { critical: "bg-red-500/20 text-red-400 border-red-500/30", high: "bg-orange-500/20 text-orange-400 border-orange-500/30", moderate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };

export const AIChurnDetection = () => {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<AtRiskLead[]>([]);
  const [summary, setSummary] = useState("");
  const [churnRate, setChurnRate] = useState("");

  const analyze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-churn-detection");
      if (error) throw error;
      setLeads(data?.at_risk_leads || []);
      setSummary(data?.summary || "");
      setChurnRate(data?.churn_rate_estimate || "");
    } catch (e: any) {
      toast.error(e.message || "Failed to detect churn");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 px-5 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Churn Risk Detection
          </CardTitle>
          <Button onClick={analyze} disabled={loading} size="sm" variant="outline" className="text-xs gap-1.5">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
            {loading ? "Scanning..." : leads.length ? "Re-scan" : "Detect Risks"}
          </Button>
        </div>
      </CardHeader>
      {(leads.length > 0 || summary) && (
        <CardContent className="px-5 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            {churnRate && <Badge variant="outline" className="text-[10px]">Est. churn: {churnRate}</Badge>}
            <Badge variant="outline" className="text-[10px]">{leads.length} at risk</Badge>
          </div>
          {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-2">
              {leads.map((lead, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{lead.business_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] ${riskColors[lead.risk_level as keyof typeof riskColors] || riskColors.moderate}`}>{lead.risk_level}</Badge>
                      <span className="text-[10px] text-muted-foreground">{lead.days_inactive}d inactive</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{lead.risk_reason}</p>
                  <p className="text-[10px] text-primary mt-1">→ {lead.save_action}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};
