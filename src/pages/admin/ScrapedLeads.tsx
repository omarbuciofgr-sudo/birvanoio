import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Download, Users, MoreHorizontal, Eye, Trash2, ExternalLink, Check, Sparkles, ShieldCheck, Copy, FileJson, Edit, Ban, History, BarChart3, TrendingUp, Tag, ListTodo, Webhook } from 'lucide-react';
import { scrapedLeadsApi, scrapeJobsApi, clientOrganizationsApi } from '@/lib/api/scraper';
import { ScrapedLead, ScrapedLeadStatus } from '@/types/scraper';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LeadDetailSheet } from '@/components/scraper/LeadDetailSheet';
import { LeadEditDialog } from '@/components/scraper/LeadEditDialog';
import { AssignLeadsDialog } from '@/components/scraper/AssignLeadsDialog';
import { SuppressionListManager } from '@/components/scraper/SuppressionListManager';
import { AuditLogViewer } from '@/components/scraper/AuditLogViewer';
import { LeadPipelineView } from '@/components/scraper/LeadPipelineView';
import { EnrichmentAnalyticsDashboard } from '@/components/scraper/EnrichmentAnalyticsDashboard';
import { LeadTagsManager, BulkTagOperations } from '@/components/scraper/LeadTagsManager';
import { SavedSearchesManager, SearchFilters } from '@/components/scraper/SavedSearchesManager';
import { LeadDeduplicationPanel } from '@/components/scraper/LeadDeduplicationPanel';
import { EnrichmentQueuePanel } from '@/components/scraper/EnrichmentQueuePanel';
import { WebhookNotificationsManager } from '@/components/scraper/WebhookNotificationsManager';
import { BulkExportDialog } from '@/components/scraper/BulkExportDialog';
import { supabase } from '@/integrations/supabase/client';

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

export default function ScrapedLeads() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('leads');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ScrapedLead | null>(null);
  const [editingLead, setEditingLead] = useState<ScrapedLead | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['scraped-leads', statusFilter, jobFilter, sourceTypeFilter],
    queryFn: () => scrapedLeadsApi.list({
      status: statusFilter !== 'all' ? statusFilter as ScrapedLeadStatus : undefined,
      job_id: jobFilter !== 'all' ? jobFilter : undefined,
      source_type: sourceTypeFilter !== 'all' ? sourceTypeFilter : undefined,
    }),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['scrape-jobs'],
    queryFn: () => scrapeJobsApi.list(),
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ['client-organizations'],
    queryFn: () => clientOrganizationsApi.list(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ScrapedLeadStatus }) =>
      scrapedLeadsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      toast.success('Status updated');
    },
    onError: (error) => toast.error(`Failed to update status: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scrapedLeadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      toast.success('Lead deleted');
    },
    onError: (error) => toast.error(`Failed to delete lead: ${error.message}`),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => scrapedLeadsApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      setSelectedLeads(new Set());
      toast.success('Leads deleted');
    },
    onError: (error) => toast.error(`Failed to delete leads: ${error.message}`),
  });

  const enrichMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('enrich-lead', {
        body: { lead_ids: leadIds },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      setSelectedLeads(new Set());
      toast.success(`Enriched ${data.results?.length || 0} lead(s)`);
    },
    onError: (error) => toast.error(`Enrichment failed: ${error.message}`),
  });

  const validateMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('validate-lead', {
        body: { lead_ids: leadIds },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      setSelectedLeads(new Set());
      toast.success(`Validated ${data.results?.length || 0} lead(s)`);
    },
    onError: (error) => toast.error(`Validation failed: ${error.message}`),
  });

  const dedupeMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('dedupe-leads', {
        body: { lead_ids: leadIds, auto_merge: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      setSelectedLeads(new Set());
      toast.success(`Found ${data.duplicates_found || 0} duplicates, merged ${data.merged_count || 0}`);
    },
    onError: (error) => toast.error(`Dedupe failed: ${error.message}`),
  });

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

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const handleExportCsv = async () => {
    try {
      const csv = await scrapedLeadsApi.exportToCsv({
        job_id: jobFilter !== 'all' ? jobFilter : undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
        job_id: jobFilter !== 'all' ? jobFilter : undefined,
      });
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export completed');
    } catch (error) {
      toast.error('Failed to export leads');
    }
  };

  const isProcessing = enrichMutation.isPending || validateMutation.isPending || dedupeMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Scraped Leads</h1>
            <p className="text-muted-foreground">Review, validate, and assign scraped leads</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="dedupe" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Deduplication
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="suppression" className="flex items-center gap-2">
              <Ban className="h-4 w-4" />
              Suppression
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="mt-6">
            <LeadPipelineView leads={leads} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <EnrichmentAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="dedupe" className="mt-6">
            <LeadDeduplicationPanel />
          </TabsContent>

          <TabsContent value="queue" className="mt-6">
            <EnrichmentQueuePanel />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <WebhookNotificationsManager />
          </TabsContent>

          <TabsContent value="leads" className="mt-6 space-y-6">
            {/* Bulk Actions */}
            <div className="flex flex-wrap gap-2">
              {selectedLeads.size > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => enrichMutation.mutate(Array.from(selectedLeads))}
                    disabled={isProcessing}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {enrichMutation.isPending ? 'Enriching...' : `Enrich (${selectedLeads.size})`}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => validateMutation.mutate(Array.from(selectedLeads))}
                    disabled={isProcessing}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {validateMutation.isPending ? 'Validating...' : `Validate (${selectedLeads.size})`}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => dedupeMutation.mutate(Array.from(selectedLeads))}
                    disabled={isProcessing}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {dedupeMutation.isPending ? 'Checking...' : `Dedupe (${selectedLeads.size})`}
                  </Button>
                  <BulkTagOperations 
                    selectedLeadIds={Array.from(selectedLeads)} 
                    onComplete={() => setSelectedLeads(new Set())}
                  />
                  <Button variant="outline" onClick={() => setAssignDialogOpen(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Assign ({selectedLeads.size})
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive"
                    onClick={() => bulkDeleteMutation.mutate(Array.from(selectedLeads))}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
              <div className="flex-1" />
              <SavedSearchesManager
                currentFilters={{
                  status: statusFilter,
                  job_id: jobFilter,
                  source_type: sourceTypeFilter,
                  search: searchTerm,
                }}
                onLoadSearch={(filters) => {
                  if (filters.status) setStatusFilter(filters.status);
                  if (filters.job_id) setJobFilter(filters.job_id);
                  if (filters.source_type) setSourceTypeFilter(filters.source_type);
                  if (filters.search) setSearchTerm(filters.search);
                }}
              />
              <BulkExportDialog 
                leads={filteredLeads} 
                selectedIds={selectedLeads.size > 0 ? Array.from(selectedLeads) : undefined}
              />
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
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="scrape">Web Scraper</SelectItem>
                  <SelectItem value="real_estate_scraper">Real Estate</SelectItem>
                  <SelectItem value="prospect_search">Prospect Search</SelectItem>
                  <SelectItem value="google_places">Google Places</SelectItem>
                  <SelectItem value="apollo">Apollo</SelectItem>
                  <SelectItem value="firecrawl">Firecrawl</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leads ({filteredLeads.length})</CardTitle>
            <CardDescription>
              Click on a lead to view full details and evidence
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading leads...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No leads found. Run a scrape job to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeads.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell onClick={() => setSelectedLead(lead)}>
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
                      <TableCell onClick={() => setSelectedLead(lead)}>
                        {lead.full_name || '-'}
                      </TableCell>
                      <TableCell onClick={() => setSelectedLead(lead)}>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[150px]">{lead.best_email || '-'}</span>
                          {lead.email_validation_status && lead.email_validation_status !== 'unverified' && (
                            <Badge className={validationColors[lead.email_validation_status]} variant="outline">
                              {lead.email_validation_status === 'verified' && <Check className="h-3 w-3" />}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setSelectedLead(lead)}>
                        <div className="flex items-center gap-2">
                          <span>{lead.best_phone || '-'}</span>
                          {lead.phone_validation_status && lead.phone_validation_status !== 'unverified' && (
                            <Badge className={validationColors[lead.phone_validation_status]} variant="outline">
                              {lead.phone_validation_status === 'verified' && <Check className="h-3 w-3" />}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setSelectedLead(lead)}>
                        <Badge className={statusColors[lead.status]}>
                          {lead.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={() => setSelectedLead(lead)}>
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
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedLead(lead)}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit Lead
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: lead.id, status: 'approved' })}
                            >
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: lead.id, status: 'rejected' })}
                            >
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(lead.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="suppression" className="mt-6">
            <SuppressionListManager organizations={organizations} />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <AuditLogViewer tableName="scraped_leads" limit={100} />
          </TabsContent>
        </Tabs>

        {/* Lead Detail Sheet */}
        <LeadDetailSheet
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />

        {/* Lead Edit Dialog */}
        <LeadEditDialog
          lead={editingLead}
          open={!!editingLead}
          onClose={() => setEditingLead(null)}
        />

        {/* Assign Dialog */}
        <AssignLeadsDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          leadIds={Array.from(selectedLeads)}
          organizations={organizations}
          onSuccess={() => setSelectedLeads(new Set())}
        />
      </div>
    </DashboardLayout>
  );
}
