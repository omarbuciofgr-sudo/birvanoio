import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnrichmentRulesManager } from '@/components/scraper/EnrichmentRulesManager';
import { LeadRoutingRulesManager } from '@/components/scraper/LeadRoutingRulesManager';
import { ScheduledJobsManager } from '@/components/scraper/ScheduledJobsManager';
import { ScraperAnalyticsDashboard } from '@/components/scraper/ScraperAnalyticsDashboard';
import { Loader2, Zap, Route, Calendar, BarChart3, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function ScraperSettings() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('analytics');

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
          <TabsList className="mb-6">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
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
          </TabsList>

          <TabsContent value="analytics">
            <ScraperAnalyticsDashboard />
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
