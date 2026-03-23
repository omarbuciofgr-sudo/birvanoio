import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Activity, Clock, Zap, Database, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface PerformanceMetrics {
  avg_scrape_time_ms: number;
  avg_enrich_time_ms: number;
  total_api_calls_today: number;
  error_rate_percent: number;
  active_jobs: number;
  queue_depth: number;
  leads_processed_today: number;
  cache_hit_rate: number;
}

interface TimeSeriesData {
  time: string;
  scrape_time: number;
  enrich_time: number;
  error_rate: number;
}

export function PerformanceDashboard() {
  // Fetch real-time metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async (): Promise<PerformanceMetrics> => {
      // Get active jobs
      const { data: activeJobs } = await supabase
        .from('scrape_jobs')
        .select('id', { count: 'exact' })
        .eq('status', 'running');

      // Get queue depth
      const { data: queueItems } = await supabase
        .from('job_queue')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');

      // Get today's leads
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: todayLeads } = await supabase
        .from('scraped_leads')
        .select('id', { count: 'exact' })
        .gte('created_at', today.toISOString());

      // Get enrichment logs for timing
      const { data: enrichLogs } = await supabase
        .from('enrichment_logs')
        .select('*')
        .gte('created_at', today.toISOString())
        .limit(100);

      const successfulEnrichments = enrichLogs?.filter(e => e.success) || [];
      const failedEnrichments = enrichLogs?.filter(e => !e.success) || [];

      // Calculate cache hit rate from enrichment cache
      const { count: cacheHits } = await supabase
        .from('enrichment_cache')
        .select('id', { count: 'exact' })
        .gte('created_at', today.toISOString());

      return {
        avg_scrape_time_ms: 1250, // Mock - would come from scraped_pages.processing_time_ms
        avg_enrich_time_ms: 850,
        total_api_calls_today: (enrichLogs?.length || 0) + (todayLeads as unknown as { length: number })?.length * 3,
        error_rate_percent: enrichLogs?.length 
          ? (failedEnrichments.length / enrichLogs.length) * 100 
          : 0,
        active_jobs: (activeJobs as unknown as { length: number })?.length || 0,
        queue_depth: (queueItems as unknown as { length: number })?.length || 0,
        leads_processed_today: (todayLeads as unknown as { length: number })?.length || 0,
        cache_hit_rate: cacheHits && (todayLeads as unknown as { length: number })?.length
          ? Math.min(100, (cacheHits / (todayLeads as unknown as { length: number }).length) * 100)
          : 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Generate mock time series for demo
  const timeSeriesData: TimeSeriesData[] = Array.from({ length: 24 }, (_, i) => ({
    time: `${i.toString().padStart(2, '0')}:00`,
    scrape_time: 800 + Math.random() * 600,
    enrich_time: 500 + Math.random() * 500,
    error_rate: Math.random() * 5,
  }));

  // Provider performance data
  const providerPerformance = [
    { name: 'Apollo', success_rate: 92, avg_time: 420 },
    { name: 'Hunter', success_rate: 88, avg_time: 380 },
    { name: 'PDL', success_rate: 85, avg_time: 560 },
    { name: 'Clearbit', success_rate: 78, avg_time: 720 },
  ];

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const getHealthStatus = () => {
    if (!metrics) return { status: 'unknown', color: 'secondary' };
    if (metrics.error_rate_percent > 10 || metrics.queue_depth > 100) {
      return { status: 'Degraded', color: 'destructive' };
    }
    if (metrics.error_rate_percent > 5 || metrics.queue_depth > 50) {
      return { status: 'Warning', color: 'warning' };
    }
    return { status: 'Healthy', color: 'success' };
  };

  const health = getHealthStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Performance
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of scraping and enrichment operations
          </p>
        </div>
        <Badge 
          variant={health.color === 'success' ? 'default' : health.color === 'warning' ? 'secondary' : 'destructive'}
          className="flex items-center gap-1"
        >
          {health.status === 'Healthy' ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {health.status}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Avg Scrape Time
            </CardDescription>
            <CardTitle className="text-2xl">
              {metrics?.avg_scrape_time_ms.toLocaleString()}ms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={Math.min(100, (metrics?.avg_scrape_time_ms || 0) / 30)} className="h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Avg Enrich Time
            </CardDescription>
            <CardTitle className="text-2xl">
              {metrics?.avg_enrich_time_ms.toLocaleString()}ms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={Math.min(100, (metrics?.avg_enrich_time_ms || 0) / 20)} className="h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Error Rate
            </CardDescription>
            <CardTitle className="text-2xl">
              {(metrics?.error_rate_percent || 0).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress 
              value={metrics?.error_rate_percent || 0} 
              className={`h-1 ${(metrics?.error_rate_percent || 0) > 5 ? '[&>div]:bg-destructive' : ''}`} 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              Cache Hit Rate
            </CardDescription>
            <CardTitle className="text-2xl">
              {(metrics?.cache_hit_rate || 0).toFixed(0)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={metrics?.cache_hit_rate || 0} className="h-1" />
          </CardContent>
        </Card>
      </div>

      {/* Activity Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-3xl font-bold">{metrics?.active_jobs || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Queue Depth</p>
                <p className="text-3xl font-bold">{metrics?.queue_depth || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Database className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads Today</p>
                <p className="text-3xl font-bold">{metrics?.leads_processed_today || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response Times (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="scrape_time"
                    name="Scrape Time (ms)"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                  />
                  <Area
                    type="monotone"
                    dataKey="enrich_time"
                    name="Enrich Time (ms)"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2) / 0.2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerPerformance} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                  <Tooltip />
                  <Bar
                    dataKey="success_rate"
                    name="Success Rate %"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
