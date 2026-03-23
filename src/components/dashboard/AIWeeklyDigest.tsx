import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, TrendingUp, Users, Phone, Mail, MessageSquare, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DigestStats {
  totalLeads: number;
  newLeadsThisWeek: number;
  contactedThisWeek: number;
  convertedThisWeek: number;
  conversionRate: string;
  statusBreakdown: {
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    lost: number;
  };
  communicationActivity: {
    calls: number;
    emails: number;
    sms: number;
  };
}

interface TopLead {
  business_name: string;
  contact_name: string | null;
  lead_score: number | null;
  status: string;
  industry: string | null;
  city: string | null;
  state: string | null;
}

interface DigestData {
  digest: string;
  stats: DigestStats;
  topLeads: TopLead[];
  generatedAt: string;
}

export function AIWeeklyDigest() {
  const [digestData, setDigestData] = useState<DigestData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateDigest = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to generate digest");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-weekly-digest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          toast.error("Too many requests. Please try again in a moment.");
          return;
        }
        if (response.status === 402) {
          toast.error("Service temporarily unavailable.");
          return;
        }
        throw new Error(errorData.error || "Failed to generate digest");
      }

      const data = await response.json();
      setDigestData(data);
      toast.success("Weekly digest generated!");
    } catch (error: any) {
      console.error("Digest error:", error);
      toast.error(error.message || "Failed to generate digest");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDigestContent = (content: string) => {
    // Parse markdown-style headers and format
    const sections = content.split(/\*\*([^*]+)\*\*/g);
    return sections.map((section, i) => {
      if (i % 2 === 1) {
        // This is a header
        return (
          <h4 key={i} className="font-semibold text-foreground mt-4 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {section}
          </h4>
        );
      }
      // This is content
      return section.split("\n").map((line, j) => {
        if (!line.trim()) return null;
        const bulletMatch = line.match(/^[-•]\s*(.+)/);
        const numberedMatch = line.match(/^\d+\.\s*(.+)/);
        if (bulletMatch || numberedMatch) {
          return (
            <p key={`${i}-${j}`} className="text-muted-foreground text-sm ml-4 my-1">
              • {bulletMatch ? bulletMatch[1] : numberedMatch![1]}
            </p>
          );
        }
        return (
          <p key={`${i}-${j}`} className="text-muted-foreground text-sm my-1">
            {line}
          </p>
        );
      });
    });
  };

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                AI Weekly Digest
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                AI-powered summary of your leads & trends
              </p>
            </div>
          </div>
          <Button
            onClick={generateDigest}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Digest
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {!digestData ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Get Your AI-Powered Insights
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Click "Generate Digest" to receive an AI analysis of your best leads, 
              conversion trends, and recommended actions for the week.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">New This Week</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{digestData.stats.newLeadsThisWeek}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Converted</span>
                </div>
                <p className="text-2xl font-bold text-status-converted">{digestData.stats.convertedThisWeek}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Phone className="w-4 h-4" />
                  <span className="text-xs">Calls Made</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{digestData.stats.communicationActivity.calls}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-xs">Emails Sent</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{digestData.stats.communicationActivity.emails}</p>
              </div>
            </div>

            {/* Top Priority Leads */}
            {digestData.topLeads.length > 0 && (
              <div>
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Top Priority Leads
                </h4>
                <div className="space-y-2">
                  {digestData.topLeads.slice(0, 3).map((lead, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{lead.business_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.contact_name && `${lead.contact_name} • `}
                            {lead.city}, {lead.state}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Score: {lead.lead_score}
                        </Badge>
                        <Badge 
                          className={`text-xs ${
                            lead.status === "qualified" 
                              ? "bg-status-qualified/20 text-status-qualified border-status-qualified/30"
                              : lead.status === "contacted"
                              ? "bg-status-contacted/20 text-status-contacted border-status-contacted/30"
                              : "bg-status-new/20 text-status-new border-status-new/30"
                          }`}
                          variant="outline"
                        >
                          {lead.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 via-transparent to-transparent border border-border">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                AI Analysis & Recommendations
              </h4>
              <div className="prose prose-sm max-w-none">
                {formatDigestContent(digestData.digest)}
              </div>
            </div>

            {/* Generated timestamp */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Generated {format(new Date(digestData.generatedAt), "MMM d, yyyy 'at' h:mm a")}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
