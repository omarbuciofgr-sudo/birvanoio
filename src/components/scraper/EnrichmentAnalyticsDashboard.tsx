import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign,
  Zap,
  Users,
  Mail,
  Phone
} from 'lucide-react';
import { format, subDays } from 'date-fns';

const PROVIDER_COLORS: Record<string, string> = {
  apollo: '#6366f1',
  hunter: '#f59e0b',
  pdl: '#10b981',
  clearbit: '#3b82f6',
  zerobounce: '#8b5cf6',
  twilio: '#ef4444',
  batchdata: '#ec4899',
  tracerfy: '#14b8a6',
};

export function EnrichmentAnalyticsDashboard() {
  // Fetch enrichment logs for analytics
  const { data: enrichmentLogs = [] } = useQuery({
    queryKey: ['enrichment-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrichment_logs')
        .select('*')
        .gte('created_at', subDays(new Date(), 30).toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch validation logs
  const { data: validationLogs = [] } = useQuery({
    queryKey: ['validation-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('validation_logs')
        .select('*')
        .gte('created_at', subDays(new Date(), 30).toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate provider stats
  const providerStats = enrichmentLogs.reduce((acc, log) => {
    const provider = log.provider;
    if (!acc[provider]) {
      acc[provider] = { total: 0, success: 0, failed: 0, cost: 0 };
    }
    acc[provider].total++;
    if (log.success) {
      acc[provider].success++;
    } else {
      acc[provider].failed++;
    }
    acc[provider].cost += log.cost_usd || 0;
    return acc;
  }, {} as Record<string, { total: number; success: number; failed: number; cost: number }>);

  const providerChartData = Object.entries(providerStats).map(([provider, stats]) => ({
    name: provider.charAt(0).toUpperCase() + provider.slice(1),
    provider,
    success: stats.success,
    failed: stats.failed,
    successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
    cost: stats.cost.toFixed(2),
  }));

  // Calculate validation stats
  const validationStats = validationLogs.reduce((acc, log) => {
    const type = log.validation_type;
    const status = log.result_status;
    if (!acc[type]) {
      acc[type] = { total: 0, verified: 0, invalid: 0, likely_valid: 0, unverified: 0 };
    }
    acc[type].total++;
    if (status === 'verified') acc[type].verified++;
    else if (status === 'invalid') acc[type].invalid++;
    else if (status === 'likely_valid') acc[type].likely_valid++;
    else acc[type].unverified++;
    return acc;
  }, {} as Record<string, { total: number; verified: number; invalid: number; likely_valid: number; unverified: number }>);

  // Daily trend data
  const dailyTrend = enrichmentLogs.reduce((acc, log) => {
    const date = format(new Date(log.created_at), 'MMM dd');
    if (!acc[date]) {
      acc[date] = { date, enrichments: 0, cost: 0 };
    }
    acc[date].enrichments++;
    acc[date].cost += log.cost_usd || 0;
    return acc;
  }, {} as Record<string, { date: string; enrichments: number; cost: number }>);

  const trendData = Object.values(dailyTrend).slice(-14);

  // Summary metrics
  const totalEnrichments = enrichmentLogs.length;
  const successfulEnrichments = enrichmentLogs.filter(l => l.success).length;
  const totalCost = enrichmentLogs.reduce((sum, l) => sum + (l.cost_usd || 0), 0);
  const avgSuccessRate = totalEnrichments > 0 ? Math.round((successfulEnrichments / totalEnrichments) * 100) : 0;
  
  const emailValidations = validationLogs.filter(l => l.validation_type === 'email');
  const phoneValidations = validationLogs.filter(l => l.validation_type === 'phone');
  const emailVerifiedRate = emailValidations.length > 0 
    ? Math.round((emailValidations.filter(l => l.result_status === 'verified').length / emailValidations.length) * 100) 
    : 0;
  const phoneVerifiedRate = phoneValidations.length > 0 
    ? Math.round((phoneValidations.filter(l => l.result_status === 'verified').length / phoneValidations.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrichments</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnrichments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSuccessRate}%</div>
            <Progress value={avgSuccessRate} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Verified</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailVerifiedRate}%</div>
            <p className="text-xs text-muted-foreground">{emailValidations.length} emails validated</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Phone Verified</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{phoneVerifiedRate}%</div>
            <p className="text-xs text-muted-foreground">{phoneValidations.length} phones validated</p>
          </CardContent>
        </Card>
      </div>

      {/* Provider Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Performance</CardTitle>
          <CardDescription>Success vs failure rates by enrichment provider</CardDescription>
        </CardHeader>
        <CardContent>
          {providerChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={providerChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Legend />
                <Bar dataKey="success" name="Success" stackId="a" fill="#10b981" />
                <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No enrichment data yet. Run some enrichments to see analytics.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Enrichment Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Enrichment Trend</CardTitle>
            <CardDescription>Enrichments over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="enrichments" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    dot={{ fill: '#6366f1' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provider Stats Table */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Statistics</CardTitle>
            <CardDescription>Detailed breakdown by provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {providerChartData.map((provider) => (
                <div key={provider.provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: PROVIDER_COLORS[provider.provider] || '#6b7280' }}
                    />
                    <span className="font-medium">{provider.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>{provider.success}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{provider.failed}</span>
                    </div>
                    <Badge variant="outline">{provider.successRate}%</Badge>
                  </div>
                </div>
              ))}
              {providerChartData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No provider data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Summary
          </CardTitle>
          <CardDescription>Estimated costs for enrichment and validation services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Total Cost (30 days)</div>
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Cost per Lead</div>
              <div className="text-2xl font-bold">
                ${totalEnrichments > 0 ? (totalCost / totalEnrichments).toFixed(3) : '0.00'}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-sm text-muted-foreground">Most Expensive Provider</div>
              <div className="text-2xl font-bold">
                {providerChartData.length > 0 
                  ? providerChartData.reduce((prev, curr) => 
                      parseFloat(curr.cost) > parseFloat(prev.cost) ? curr : prev
                    ).name
                  : 'N/A'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
