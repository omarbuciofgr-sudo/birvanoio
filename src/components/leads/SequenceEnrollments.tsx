import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";

interface Enrollment {
  id: string;
  status: string;
  current_step: number;
  enrolled_at: string;
  campaign?: { id: string; name: string | null } | null;
}

export default function SequenceEnrollments({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("lead_campaign_enrollments")
        .select("id,status,current_step,enrolled_at,campaign:email_campaigns(id,name)")
        .eq("lead_id", leadId)
        .order("enrolled_at", { ascending: false });
      if (!alive) return;
      setRows((data ?? []) as unknown as Enrollment[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [leadId]);

  if (loading) return <p className="text-[11px] text-muted-foreground">Loading sequences…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Not enrolled in any sequence yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-muted/20 px-2 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Send className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium truncate">
              {r.campaign?.name || "Unnamed sequence"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-muted-foreground">Step {r.current_step}</span>
            <Badge
              variant="outline"
              className={`text-[9px] ${
                r.status === "active" ? "border-green-500/40 text-green-700 dark:text-green-400" :
                r.status === "paused" ? "border-yellow-500/40 text-yellow-700 dark:text-yellow-400" :
                "border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {r.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
