import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnrichmentRulesManager } from '@/components/scraper/EnrichmentRulesManager';
import { LeadRoutingRulesManager } from '@/components/scraper/LeadRoutingRulesManager';
import { ScheduledJobsManager } from '@/components/scraper/ScheduledJobsManager';
import { ScraperAnalyticsDashboard } from '@/components/scraper/ScraperAnalyticsDashboard';
import { SuppressionListManager } from '@/components/scraper/SuppressionListManager';
import { AuditLogViewer } from '@/components/scraper/AuditLogViewer';
import { LeadPipelineView } from '@/components/scraper/LeadPipelineView';
import { ScraperMonitoringPanel } from '@/components/scraper/ScraperMonitoringPanel';
import { EnrichmentAnalyticsDashboard } from '@/components/scraper/EnrichmentAnalyticsDashboard';
import { IntentSignalsConfig } from '@/components/scraper/IntentSignalsConfig';
import { ClientWebhooksManager } from '@/components/scraper/ClientWebhooksManager';
import { LeadScoringConfig } from '@/components/scraper/LeadScoringConfig';
import { NotificationChannelsManager } from '@/components/scraper/NotificationChannelsManager';
import { CRMIntegrationsManager } from '@/components/scraper/CRMIntegrationsManager';
import { BackupJobsManager } from '@/components/scraper/BackupJobsManager';
import { PerformanceDashboard } from '@/components/scraper/PerformanceDashboard';
import { Loader2, Zap, Route, Calendar, BarChart3, Settings, Ban, History, Kanban, Activity, DollarSign, Target, Webhook, Brain, Bell, Link2, HardDrive, Gauge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ClientOrganization, ScrapedLead } from '@/types/scraper';

export default function ScraperSettings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('monitoring');

  useEffect(() => {
    const checkAdminRole = async () => {
      if (authLoading) return;
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-admin');
      if (error || data?.error) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(!!data?.isAdmin);
    };

    checkAdminRole();
  }, [user?.id, authLoading]);

  // Fetch organizations for suppression list
  const { data: organizations = [] } = useQuery({
    queryKey: ['client-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_organizations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as ClientOrganization[];
    },
    enabled: isAdmin === true,
  });

  // Fetch leads for pipeline view
  const { data: leads = [] } = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraped_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as ScrapedLead[];
    },
    enabled: isAdmin === true && activeTab === 'pipeline',
  });

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!isAdmin) {
    navigate('/dashboard');
    toast.error('Access denied. Admin privileges required.');
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Scraper Settings & Analytics
          </h1>
          <p className="text-muted-foreground">
            Configure automation rules, schedules, and view performance analytics
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <Kanban className="h-4 w-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="enrichment" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Auto-Enrichment
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Lead Routing
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Jobs
            </TabsTrigger>
            <TabsTrigger value="suppression" className="flex items-center gap-2">
              <Ban className="h-4 w-4" />
              Suppression
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger value="enrichment-analytics" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Enrichment Costs
            </TabsTrigger>
            <TabsTrigger value="intent-signals" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Intent Signals
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="scoring" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Lead Scoring
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              CRM
            </TabsTrigger>
            <TabsTrigger value="backups" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Backups
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitoring">
            <ScraperMonitoringPanel />
          </TabsContent>

          <TabsContent value="analytics">
            <ScraperAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="pipeline">
            <LeadPipelineView leads={leads} />
          </TabsContent>

          <TabsContent value="enrichment">
            <EnrichmentRulesManager />
          </TabsContent>

          <TabsContent value="routing">
            <LeadRoutingRulesManager />
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledJobsManager />
          </TabsContent>

          <TabsContent value="suppression">
            <SuppressionListManager organizations={organizations} />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogViewer limit={100} />
          </TabsContent>

          <TabsContent value="enrichment-analytics">
            <EnrichmentAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="intent-signals">
            <IntentSignalsConfig />
          </TabsContent>

          <TabsContent value="webhooks">
            <ClientWebhooksManager organizations={organizations} />
          </TabsContent>

          <TabsContent value="scoring">
            <LeadScoringConfig />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationChannelsManager />
          </TabsContent>

          <TabsContent value="crm">
            <CRMIntegrationsManager />
          </TabsContent>

          <TabsContent value="backups">
            <BackupJobsManager />
          </TabsContent>

          <TabsContent value="performance">
            <PerformanceDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
