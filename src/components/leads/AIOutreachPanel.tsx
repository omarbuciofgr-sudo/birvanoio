import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Mail, MessageSquare, Linkedin, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface OutreachStep {
  step: number;
  channel: "email" | "sms" | "linkedin";
  delay_days: number;
  subject: string;
  body: string;
}

interface AIOutreachPanelProps {
  lead: {
    business_name: string;
    contact_name?: string | null;
    industry?: string | null;
    city?: string | null;
    state?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

const channelIcons = {
  email: Mail,
  sms: MessageSquare,
  linkedin: Linkedin,
};

export const AIOutreachPanel = ({ lead }: AIOutreachPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<OutreachStep[]>([]);
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [tone, setTone] = useState("professional");
  const [goal, setGoal] = useState("book a meeting");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const generate = async () => {
    if (channels.length === 0) {
      toast.error("Select at least one channel");
      return;
    }
    setLoading(true);
    setSteps([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-outreach-agent", {
        body: { lead, channels, tone, goal },
      });
      if (error) throw error;
      if (data?.steps) {
        setSteps(data.steps);
        toast.success(`Generated ${data.steps.length}-step sequence`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate sequence");
    } finally {
      setLoading(false);
    }
  };

  const copyStep = (idx: number) => {
    const s = steps[idx];
    const text = s.channel === "email" ? `Subject: ${s.subject}\n\n${s.body}` : s.body;
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">AI Outreach Agent</h3>
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tone</label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Goal</label>
          <Select value={goal} onValueChange={setGoal}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="book a meeting">Book a Meeting</SelectItem>
              <SelectItem value="get a reply">Get a Reply</SelectItem>
              <SelectItem value="share a resource">Share Resource</SelectItem>
              <SelectItem value="close a deal">Close a Deal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Channels</label>
        <div className="flex gap-4">
          {(["email", "sms", "linkedin"] as const).map((ch) => (
            <label key={ch} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={channels.includes(ch)}
                onCheckedChange={() => toggleChannel(ch)}
              />
              <span className="capitalize">{ch}</span>
            </label>
          ))}
        </div>
      </div>

      <Button onClick={generate} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? "Generating..." : "Generate Sequence"}
      </Button>

      {/* Results */}
      {steps.length > 0 && (
        <div className="space-y-3 mt-4">
          {steps.map((step, idx) => {
            const Icon = channelIcons[step.channel] || Mail;
            return (
              <Card key={idx} className="bg-secondary/30 border-border">
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Icon className="w-3 h-3" />
                      {step.channel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Step {step.step} · Day {step.delay_days}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyStep(idx)}
                  >
                    {copiedIdx === idx ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  {step.channel === "email" && (
                    <p className="text-xs font-medium text-foreground mb-1">
                      Subject: {step.subject}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{step.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
