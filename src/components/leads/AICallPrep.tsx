import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Phone as PhoneIcon, MessageSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CallBrief {
  executive_summary: string;
  talking_points: string[];
  questions_to_ask: string[];
  objection_handlers: { objection: string; response: string }[];
  key_pain_points: string[];
  conversation_opener: string;
  closing_strategy: string;
  do_not_mention?: string[];
}

interface AICallPrepProps {
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
  };
}

export const AICallPrep = ({ lead }: AICallPrepProps) => {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<CallBrief | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-call-prep", {
        body: { lead },
      });
      if (error) throw error;
      setBrief(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Call Prep Brief</h3>
        </div>
        <Button onClick={generate} disabled={loading} size="sm" variant="outline" className="gap-1.5 text-xs">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneIcon className="h-3 w-3" />}
          {loading ? "Preparing..." : brief ? "Refresh" : "Generate Brief"}
        </Button>
      </div>

      {brief && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-sm text-muted-foreground">{brief.executive_summary}</p>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium text-primary mb-1">Opening Line</p>
              <p className="text-xs text-foreground">{brief.conversation_opener}</p>
            </CardContent>
          </Card>

          <div>
            <p className="text-[10px] font-medium text-foreground mb-1 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Talking Points</p>
            {brief.talking_points.map((t, i) => (
              <p key={i} className="text-xs text-muted-foreground pl-3">• {t}</p>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-medium text-foreground mb-1">Questions to Ask</p>
            {brief.questions_to_ask.map((q, i) => (
              <p key={i} className="text-xs text-muted-foreground pl-3">{i + 1}. {q}</p>
            ))}
          </div>

          {brief.objection_handlers.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-foreground mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-400" /> Objection Handlers</p>
              {brief.objection_handlers.map((o, i) => (
                <div key={i} className="mb-2 pl-3">
                  <p className="text-xs font-medium text-foreground">"{o.objection}"</p>
                  <p className="text-xs text-muted-foreground">→ {o.response}</p>
                </div>
              ))}
            </div>
          )}

          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium text-green-500 mb-1">Closing Strategy</p>
              <p className="text-xs text-foreground">{brief.closing_strategy}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
