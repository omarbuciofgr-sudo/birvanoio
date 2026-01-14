import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrapedLead, ScrapedLeadStatus } from '@/types/scraper';
import { FileSearch, CheckCircle, Users, Trophy, XCircle, Clock, Eye, Sparkles } from 'lucide-react';

interface LeadPipelineViewProps {
  leads: ScrapedLead[];
}

const PIPELINE_STAGES: { status: ScrapedLeadStatus; label: string; icon: React.ElementType; color: string }[] = [
  { status: 'new', label: 'New', icon: FileSearch, color: 'bg-blue-500' },
  { status: 'review', label: 'Review', icon: Eye, color: 'bg-yellow-500' },
  { status: 'approved', label: 'Approved', icon: CheckCircle, color: 'bg-green-500' },
  { status: 'assigned', label: 'Assigned', icon: Users, color: 'bg-purple-500' },
  { status: 'in_progress', label: 'In Progress', icon: Clock, color: 'bg-orange-500' },
  { status: 'won', label: 'Won', icon: Trophy, color: 'bg-emerald-500' },
  { status: 'lost', label: 'Lost', icon: XCircle, color: 'bg-muted' },
  { status: 'rejected', label: 'Rejected', icon: XCircle, color: 'bg-destructive' },
];

export function LeadPipelineView({ leads }: LeadPipelineViewProps) {
  const stageCounts = useMemo(() => {
    const counts: Record<ScrapedLeadStatus, number> = {
      new: 0,
      review: 0,
      approved: 0,
      assigned: 0,
      in_progress: 0,
      won: 0,
      lost: 0,
      rejected: 0,
    };
    
    leads.forEach(lead => {
      counts[lead.status] = (counts[lead.status] || 0) + 1;
    });
    
    return counts;
  }, [leads]);

  const enrichmentStats = useMemo(() => {
    let withEmail = 0;
    let withPhone = 0;
    let enriched = 0;
    let validated = 0;

    leads.forEach(lead => {
      if (lead.best_email) withEmail++;
      if (lead.best_phone) withPhone++;
      if (lead.enrichment_providers_used && (lead.enrichment_providers_used as string[]).length > 0) enriched++;
      if (lead.email_validation_status === 'verified' || lead.phone_validation_status === 'verified') validated++;
    });

    return { withEmail, withPhone, enriched, validated };
  }, [leads]);

  const total = leads.length;
  const activeLeads = stageCounts.new + stageCounts.review + stageCounts.approved + stageCounts.assigned + stageCounts.in_progress;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-sm text-muted-foreground">Total Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{activeLeads}</div>
            <p className="text-sm text-muted-foreground">Active Pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stageCounts.won}</div>
            <p className="text-sm text-muted-foreground">Won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{stageCounts.rejected + stageCounts.lost}</div>
            <p className="text-sm text-muted-foreground">Lost/Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Lead Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PIPELINE_STAGES.slice(0, 6).map((stage) => {
              const count = stageCounts[stage.status];
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const Icon = stage.icon;

              return (
                <div key={stage.status} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{stage.label}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Data Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xl font-bold">{total > 0 ? Math.round((enrichmentStats.withEmail / total) * 100) : 0}%</div>
              <p className="text-xs text-muted-foreground">Has Email</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xl font-bold">{total > 0 ? Math.round((enrichmentStats.withPhone / total) * 100) : 0}%</div>
              <p className="text-xs text-muted-foreground">Has Phone</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xl font-bold">{total > 0 ? Math.round((enrichmentStats.enriched / total) * 100) : 0}%</div>
              <p className="text-xs text-muted-foreground">Enriched</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xl font-bold">{total > 0 ? Math.round((enrichmentStats.validated / total) * 100) : 0}%</div>
              <p className="text-xs text-muted-foreground">Validated</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
