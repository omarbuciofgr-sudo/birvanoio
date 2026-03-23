import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Bell, BellOff, CheckCircle2, DollarSign, Zap } from "lucide-react";
import { toast } from "sonner";

interface SpendAlert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  metadata: Record<string, any> | null;
  is_acknowledged: boolean;
  created_at: string;
}

export function SpendAlertsPanel() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["spend-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spend_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SpendAlert[];
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("spend_alerts")
        .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spend-alerts"] });
      toast.success("Alert acknowledged");
    },
  });

  const unackedCount = alerts.filter((a) => !a.is_acknowledged).length;

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "critical":
        return { className: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle };
      case "warning":
        return { className: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: AlertTriangle };
      default:
        return { className: "bg-primary/10 text-primary border-primary/30", icon: Bell };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "high_hourly_spend":
      case "budget_exceeded":
        return DollarSign;
      case "concurrent_limit":
        return Zap;
      default:
        return AlertTriangle;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Spend Alerts
          {unackedCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unackedCount} new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Abnormal spend patterns and limit violations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading alerts…</p>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
            <p className="text-sm text-muted-foreground">No spend alerts. Everything looks healthy.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {alerts.map((alert) => {
                const config = getSeverityConfig(alert.severity);
                const TypeIcon = getTypeIcon(alert.alert_type);

                return (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 space-y-1.5 ${
                      alert.is_acknowledged ? "opacity-50" : ""
                    } ${config.className}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {alert.alert_type.replace(/_/g, " ")}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {alert.severity}
                        </Badge>
                      </div>
                      {!alert.is_acknowledged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                        >
                          <BellOff className="h-3 w-3 mr-1" />
                          Ack
                        </Button>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
