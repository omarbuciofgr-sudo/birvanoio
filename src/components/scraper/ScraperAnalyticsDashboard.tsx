import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scraperAnalyticsApi, SourceMetrics, OverallMetrics } from '@/lib/api/scraperFeatures';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, subDays } from 'date-fns';
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
} from 'recharts';
import {
  Loader2,
  TrendingUp,
  Users,
  CheckCircle,
  DollarSign,
  Target,
  Award,
  RefreshCw,
} from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type DateRange = '7d' | '30d' | '90d' | 'all';

export function ScraperAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const getDateRange = (range: DateRange): { start: string; end: string } => {
    const end = new Date();
    let start: Date;
    
    switch (range) {
      case '7d':
        start = subDays(end, 7);
        break;
      case '30d':
        start = subDays(end, 30);
        break;
      case '90d':
        start = subDays(end, 90);
        break;
      case 'all':
        start = subDays(end, 365);
        break;
    }
    
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };
  };

  const { start, end } = getDateRange(dateRange);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['scraper-analytics', start, end],
    queryFn: () => scraperAnalyticsApi.getAnalytics(start, end),
  });

  const overall = data?.overall;
  const bySource = data?.by_source || [];

  const pieData = bySource.map(s => ({
    name: s.source_type,
    value: s.leads_generated,
  }));

  const barData = bySource.map(s => ({
    source: s.source_type.replace(/_/g, ' '),
    generated: s.leads_generated,
    enriched: s.leads_enriched,
    converted: s.leads_converted,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Scraper Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Performance metrics and source analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Leads</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overall?.total_leads.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Verified</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overall?.total_verified.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Conversion Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overall?.conversion_rate.toFixed(1) || 0}%</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Total Cost</span>
            </div>
            <p className="text-2xl font-bold mt-1">${overall?.total_cost.toFixed(2) || '0.00'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Sources & Best Performing */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Top Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold capitalize">
              {overall?.top_source?.replace(/_/g, ' ') || 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">Most leads generated</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4" />
              Best Converting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold capitalize">
              {overall?.best_converting_source?.replace(/_/g, ' ') || 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">Highest conversion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {bySource.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Leads by Source</CardTitle>
              <CardDescription>Distribution of leads across sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Funnel by Source</CardTitle>
              <CardDescription>Generated → Enriched → Converted</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="generated" fill="#3b82f6" name="Generated" />
                    <Bar dataKey="enriched" fill="#10b981" name="Enriched" />
                    <Bar dataKey="converted" fill="#f59e0b" name="Converted" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Source Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Source Performance Details</CardTitle>
          <CardDescription>Detailed metrics for each lead source</CardDescription>
        </CardHeader>
        <CardContent>
          {bySource.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Source</th>
                    <th className="text-right py-2 px-2">Generated</th>
                    <th className="text-right py-2 px-2">Enriched</th>
                    <th className="text-right py-2 px-2">Verified</th>
                    <th className="text-right py-2 px-2">Assigned</th>
                    <th className="text-right py-2 px-2">Converted</th>
                    <th className="text-right py-2 px-2">Avg Score</th>
                    <th className="text-right py-2 px-2">Cost</th>
                    <th className="text-right py-2 px-2">CPL</th>
                    <th className="text-right py-2 px-2">Conv %</th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((source, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="capitalize">
                          {source.source_type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-2 font-medium">{source.leads_generated}</td>
                      <td className="text-right py-2 px-2">{source.leads_enriched}</td>
                      <td className="text-right py-2 px-2">{source.leads_verified}</td>
                      <td className="text-right py-2 px-2">{source.leads_assigned}</td>
                      <td className="text-right py-2 px-2">{source.leads_converted}</td>
                      <td className="text-right py-2 px-2">{source.avg_lead_score}</td>
                      <td className="text-right py-2 px-2">${source.total_cost_usd.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">${source.cost_per_lead.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">
                        <Badge variant={source.conversion_rate > 5 ? 'default' : 'secondary'}>
                          {source.conversion_rate.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No data available for the selected period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
