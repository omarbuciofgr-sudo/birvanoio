import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Search, Download, ExternalLink, Check, FileJson } from 'lucide-react';
import { scrapedLeadsApi } from '@/lib/api/scraper';
import { ScrapedLead, ScrapedLeadStatus } from '@/types/scraper';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { LeadDetailSheet } from '@/components/scraper/LeadDetailSheet';

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow 
                      key={lead.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLead(lead)}
                    >
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
                      <TableCell className="text-muted-foreground text-sm">
                        {lead.assigned_at ? format(new Date(lead.assigned_at), 'MMM d, yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
