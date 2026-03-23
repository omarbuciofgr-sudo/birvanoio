import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Zap, Phone, Mail, MessageSquare, Linkedin } from "lucide-react";
import { toast } from "sonner";

interface PriorityTask {
  lead_id: string;
  business_name: string;
  priority: string;
  action: string;
  reason: string;
  best_channel: string;
  best_time?: string;
}

const priorityColors = { critical: "bg-red-500/20 text-red-400", high: "bg-orange-500/20 text-orange-400", medium: "bg-yellow-500/20 text-yellow-400", low: "bg-blue-500/20 text-blue-400" };
const channelIcons = { call: Phone, email: Mail, sms: MessageSquare, linkedin: Linkedin };

export const AISmartPriority = () => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<PriorityTask[]>([]);
  const [summary, setSummary] = useState("");

  const analyze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-smart-priority");
      if (error) throw error;
      setTasks(data?.tasks || []);
      setSummary(data?.summary || "");
    } catch (e: any) {
      toast.error(e.message || "Failed to prioritize");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 px-5 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Smart Daily Priorities
          </CardTitle>
          <Button onClick={analyze} disabled={loading} size="sm" variant="outline" className="text-xs gap-1.5">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            {loading ? "Analyzing..." : tasks.length ? "Refresh" : "Prioritize"}
          </Button>
        </div>
      </CardHeader>
      {(tasks.length > 0 || summary) && (
        <CardContent className="px-5 pb-4 space-y-3">
          {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {tasks.map((task, i) => {
                const ChannelIcon = channelIcons[task.best_channel as keyof typeof channelIcons] || Mail;
                return (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Badge className={`text-[9px] px-1.5 ${priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium}`}>{task.priority}</Badge>
                      <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{task.business_name}</p>
                      <p className="text-[11px] text-foreground mt-0.5">{task.action}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{task.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};
