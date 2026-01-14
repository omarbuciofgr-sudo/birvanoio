import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Download, ExternalLink, Check, FileJson, Brain, Loader2, PhoneCall, MessageSquare, HelpCircle, TrendingUp } from 'lucide-react';
import { scrapedLeadsApi } from '@/lib/api/scraper';
import { ScrapedLead, ScrapedLeadStatus } from '@/types/scraper';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { LeadDetailSheet } from '@/components/scraper/LeadDetailSheet';

interface ScoredLead {
  id: string;
  score: number;
  priority: 'high' | 'medium' | 'low';
  ai_insights: string;
  recommended_action: string;
  score_breakdown: {
    data_completeness: number;
    contact_quality: number;
    decision_maker_fit: number;
    company_fit: number;
  };
}

interface ScoringSummary {
  total_leads: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  average_score: number;
}

const statusColors: Record<ScrapedLeadStatus, string> = {
  new: 'bg-blue-500/20 text-blue-600',
  review: 'bg-yellow-500/20 text-yellow-600',
  approved: 'bg-green-500/20 text-green-600',
  assigned: 'bg-purple-500/20 text-purple-600',
  in_progress: 'bg-orange-500/20 text-orange-600',
  won: 'bg-emerald-500/20 text-emerald-600',
  lost: 'bg-muted text-muted-foreground',
  rejected: 'bg-destructive/20 text-destructive',
};

const validationColors = {
  unverified: 'bg-muted text-muted-foreground',
  likely_valid: 'bg-yellow-500/20 text-yellow-600',
  verified: 'bg-green-500/20 text-green-600',
  invalid: 'bg-destructive/20 text-destructive',
};

export default function ClientLeads() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<ScrapedLead | null>(null);
  const [scoredLeads, setScoredLeads] = useState<Map<string, ScoredLead>>(new Map());
  const [scoringSummary, setScoringSummary] = useState<ScoringSummary | null>(null);

  // Get the current user's organization
  const { data: userOrg } = useQuery({
    queryKey: ['user-organization'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      
      const { data } = await supabase
        .from('client_users')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();
      
      return data?.organization_id || null;
    },
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['client-leads', userOrg, statusFilter],
    queryFn: () => scrapedLeadsApi.list({
      assigned_to_org: userOrg || undefined,
      status: statusFilter !== 'all' ? statusFilter as ScrapedLeadStatus : undefined,
    }),
    enabled: !!userOrg,
  });

  // AI Lead Scoring mutation
  const scoringMutation = useMutation({
    mutationFn: async (leadsToScore: ScrapedLead[]) => {
      const formattedLeads = leadsToScore.map(lead => ({
        id: lead.id,
        full_name: lead.full_name,
        email: lead.best_email,
        phone: lead.best_phone,
        job_title: lead.best_contact_title,
        company_name: lead.domain,
        email_validation_status: lead.email_validation_status,
        phone_validation_status: lead.phone_validation_status,
      }));

      const { data, error } = await supabase.functions.invoke('ai-lead-scoring', {
        body: { leads: formattedLeads, use_ai: true },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.success && data.data) {
        const newScoredLeads = new Map<string, ScoredLead>();
        data.data.forEach((scored: any) => {
          if (scored.id) {
            newScoredLeads.set(scored.id, {
              id: scored.id,
              score: scored.score,
              priority: scored.priority,
              ai_insights: scored.ai_insights,
              recommended_action: scored.recommended_action,
              score_breakdown: scored.score_breakdown,
            });
          }
        });
        setScoredLeads(newScoredLeads);
        setScoringSummary(data.summary);
        toast.success('AI scoring complete');
      } else {
        toast.error(data?.error || 'Scoring failed');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Scoring failed');
    },
  });

  const handleScoreLeads = () => {
    if (filteredLeads.length === 0) {
      toast.error('No leads to score');
      return;
    }
    // Score up to 20 leads at a time
    const leadsToScore = filteredLeads.slice(0, 20);
    scoringMutation.mutate(leadsToScore);
  };

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500 text-white">🔥 High</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500 text-white">⚡ Medium</Badge>;
      case 'low':
        return <Badge variant="outline">📋 Low</Badge>;
    }
  };

  const getActionIcon = (action: string) => {
    if (action.toLowerCase().includes('call')) return <PhoneCall className="h-3 w-3" />;
    if (action.toLowerCase().includes('email')) return <MessageSquare className="h-3 w-3" />;
    return <HelpCircle className="h-3 w-3" />;
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.domain.toLowerCase().includes(search) ||
      lead.full_name?.toLowerCase().includes(search) ||
      lead.best_email?.toLowerCase().includes(search) ||
      lead.best_phone?.includes(search)
    );
  });

  // Sort by score if available
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const scoreA = scoredLeads.get(a.id)?.score || 0;
    const scoreB = scoredLeads.get(b.id)?.score || 0;
    return scoreB - scoreA;
  });

  const handleExportCsv = async () => {
    try {
      const csv = await scrapedLeadsApi.exportToCsv({
        assigned_to_org: userOrg || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export completed');
    } catch (error) {
      toast.error('Failed to export leads');
    }
  };

  const handleExportJson = async () => {
    try {
      const json = await scrapedLeadsApi.exportToJson({
        assigned_to_org: userOrg || undefined,
      });
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-leads-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export completed');
    } catch (error) {
      toast.error('Failed to export leads');
    }
  };

  if (!userOrg) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No Organization Assigned</CardTitle>
              <CardDescription>
                You haven't been assigned to an organization yet. Please contact your administrator to get access to leads.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Leads</h1>
            <p className="text-muted-foreground">View and manage leads assigned to you</p>
          </div>
          <div className="flex gap-2">
            {leads.length > 0 && leads.length <= 20 && scoredLeads.size === 0 && (
              <Button 
                variant="outline" 
                onClick={handleScoreLeads}
                disabled={scoringMutation.isPending}
              >
                {scoringMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                AI Score Leads
              </Button>
            )}
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handleExportJson}>
              <FileJson className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by domain, name, email, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Summary */}
        {scoringSummary && (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="font-medium">AI Scoring Summary</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {scoringSummary.high_priority} High Priority
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {scoringSummary.medium_priority} Medium
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    {scoringSummary.low_priority} Low
                  </span>
                  <span className="ml-2">Avg Score: <strong>{scoringSummary.average_score}</strong></span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-2xl">{leads.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-2xl text-orange-600">
                {leads.filter(l => l.status === 'in_progress').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Won</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {leads.filter(l => l.status === 'won').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Verified Contacts</CardDescription>
              <CardTitle className="text-2xl text-emerald-600">
                {leads.filter(l => l.email_validation_status === 'verified' || l.phone_validation_status === 'verified').length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Leads ({filteredLeads.length})</CardTitle>
            <CardDescription>
              Click on a lead to view full details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading leads...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leads assigned to you yet.
              </div>
            ) : (
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {scoredLeads.size > 0 && <TableHead>Priority</TableHead>}
                      <TableHead>Domain</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      {scoredLeads.size > 0 ? (
                        <TableHead>Score</TableHead>
                      ) : (
                        <TableHead>Confidence</TableHead>
                      )}
                      {scoredLeads.size > 0 && <TableHead>Action</TableHead>}
                      <TableHead>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLeads.map((lead) => {
                      const scored = scoredLeads.get(lead.id);
                      return (
                        <TableRow 
                          key={lead.id} 
                          className={`cursor-pointer hover:bg-muted/50 ${
                            scored?.priority === 'high' ? 'border-l-4 border-l-red-500' : 
                            scored?.priority === 'medium' ? 'border-l-4 border-l-amber-500' : ''
                          }`}
                          onClick={() => setSelectedLead(lead)}
                        >
                          {scoredLeads.size > 0 && (
                            <TableCell>
                              {scored ? getPriorityBadge(scored.priority) : '-'}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{lead.domain}</span>
                              {lead.source_url && (
                                <a
                                  href={lead.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.full_name || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[150px]">{lead.best_email || '-'}</span>
                              {lead.email_validation_status && lead.email_validation_status !== 'unverified' && (
                                <Badge className={validationColors[lead.email_validation_status]} variant="outline">
                                  {lead.email_validation_status === 'verified' && <Check className="h-3 w-3" />}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{lead.best_phone || '-'}</span>
                              {lead.phone_validation_status && lead.phone_validation_status !== 'unverified' && (
                                <Badge className={validationColors[lead.phone_validation_status]} variant="outline">
                                  {lead.phone_validation_status === 'verified' && <Check className="h-3 w-3" />}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[lead.status]}>
                              {lead.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {scored ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="cursor-help flex items-center gap-1 w-fit">
                                    <TrendingUp className="h-3 w-3" />
                                    {scored.score}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">Score Breakdown:</p>
                                    <p>Data: {scored.score_breakdown.data_completeness}/25</p>
                                    <p>Contact: {scored.score_breakdown.contact_quality}/25</p>
                                    <p>Decision Maker: {scored.score_breakdown.decision_maker_fit}/25</p>
                                    <p>Company Fit: {scored.score_breakdown.company_fit}/25</p>
                                    {scored.ai_insights && (
                                      <>
                                        <p className="font-medium mt-2">AI Insight:</p>
                                        <p>{scored.ai_insights}</p>
                                      </>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      lead.confidence_score >= 80
                                        ? 'bg-green-500'
                                        : lead.confidence_score >= 50
                                        ? 'bg-yellow-500'
                                        : 'bg-destructive'
                                    }`}
                                    style={{ width: `${lead.confidence_score}%` }}
                                  />
                                </div>
                                <span className="text-sm">{lead.confidence_score}%</span>
                              </div>
                            )}
                          </TableCell>
                          {scoredLeads.size > 0 && (
                            <TableCell>
                              {scored ? (
                                <Badge variant="outline" className="flex items-center gap-1 w-fit bg-primary/10">
                                  {getActionIcon(scored.recommended_action)}
                                  <span className="text-xs">{scored.recommended_action}</span>
                                </Badge>
                              ) : '-'}
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground text-sm">
                            {lead.assigned_at ? format(new Date(lead.assigned_at), 'MMM d, yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>

        {/* Lead Detail Sheet */}
        <LeadDetailSheet
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      </div>
    </DashboardLayout>
  );
}
