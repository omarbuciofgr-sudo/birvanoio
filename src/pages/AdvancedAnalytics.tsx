import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Target, DollarSign, Mail,
  Phone, Zap, Loader2, Calendar,
} from "lucide-react";
import { subDays, format, startOfWeek, eachDayOfInterval } from "date-fns";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type DateRange = "7d" | "30d" | "90d";

export default function AdvancedAnalytics() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const getDays = (r: DateRange) => r === "7d" ? 7 : r === "30d" ? 30 : 90;
  const since = format(subDays(new Date(), getDays(dateRange)), "yyyy-MM-dd");

  // Lead metrics
  const { data: leadStats, isLoading } = useQuery({
    queryKey: ["analytics-leads", since],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("id, status, created_at, lead_score, source")
        .gte("created_at", since);
      if (error) throw error;

      const total = leads?.length || 0;
      const byStatus: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      let totalScore = 0;

      (leads || []).forEach(l => {
        byStatus[l.status || "unknown"] = (byStatus[l.status || "unknown"] || 0) + 1;
        bySource[l.source || "unknown"] = (bySource[l.source || "unknown"] || 0) + 1;
        const day = format(new Date(l.created_at), "MMM dd");
        byDay[day] = (byDay[day] || 0) + 1;
        totalScore += l.lead_score || 0;
      });

      return {
        total,
        avgScore: total > 0 ? Math.round(totalScore / total) : 0,
        byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
        bySource: Object.entries(bySource).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })).sort((a, b) => b.value - a.value).slice(0, 8),
        byDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
      };
    },
    enabled: !!user,
  });

  // Deal metrics
  const { data: dealStats } = useQuery({
    queryKey: ["analytics-deals", since],
    queryFn: async () => {
      const { data: deals, error } = await supabase
        .from("deals")
        .select("id, deal_value, stage_id, created_at, pipeline_stages(name, is_win, is_loss)")
        .gte("created_at", since);
      if (error) throw error;

      const total = deals?.length || 0;
      let totalValue = 0;
      let wonValue = 0;
      let wonCount = 0;
      const byStage: Record<string, { count: number; value: number }> = {};

      (deals || []).forEach((d: any) => {
        const val = d.deal_value || 0;
        totalValue += val;
        const stageName = d.pipeline_stages?.name || "Unknown";
        if (!byStage[stageName]) byStage[stageName] = { count: 0, value: 0 };
        byStage[stageName].count++;
        byStage[stageName].value += val;
        if (d.pipeline_stages?.is_win) { wonValue += val; wonCount++; }
      });

      return {
        total,
        totalValue,
        wonValue,
        wonCount,
        winRate: total > 0 ? Math.round((wonCount / total) * 100) : 0,
        avgDealSize: total > 0 ? Math.round(totalValue / total) : 0,
        byStage: Object.entries(byStage).map(([name, data]) => ({ name, ...data })),
      };
    },
    enabled: !!user,
  });

  // Communication metrics
  const { data: commStats } = useQuery({
    queryKey: ["analytics-comms", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_logs")
        .select("id, type, created_at, sentiment")
        .gte("created_at", since);
      if (error) throw error;

      const byType: Record<string, number> = {};
      const bySentiment: Record<string, number> = {};
      (data || []).forEach(c => {
        byType[c.type] = (byType[c.type] || 0) + 1;
        if (c.sentiment) bySentiment[c.sentiment] = (bySentiment[c.sentiment] || 0) + 1;
      });

      return {
        total: data?.length || 0,
        byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
        bySentiment: Object.entries(bySentiment).map(([name, value]) => ({ name, value })),
      };
    },
    enabled: !!user,
  });

  const StatCard = ({ icon: Icon, label, value, sub, trend }: any) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          {trend && (
            <Badge variant="outline" className="text-xs">
              {trend > 0 ? <TrendingUp className="h-3 w-3 mr-1 text-green-500" /> : <TrendingDown className="h-3 w-3 mr-1 text-red-500" />}
              {Math.abs(trend)}%
            </Badge>
          )}
        </div>
        <p className="text-2xl font-bold mt-2">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Deep insights across your leads, deals, and outreach</p>
          </div>
          <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Leads" value={leadStats?.total || 0} />
          <StatCard icon={Target} label="Avg Lead Score" value={leadStats?.avgScore || 0} sub="out of 100" />
          <StatCard icon={DollarSign} label="Pipeline Value" value={`$${((dealStats?.totalValue || 0) / 1000).toFixed(1)}k`} />
          <StatCard icon={Zap} label="Win Rate" value={`${dealStats?.winRate || 0}%`} sub={`${dealStats?.wonCount || 0} deals won`} />
        </div>

        <Tabs defaultValue="leads">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="outreach">Outreach</TabsTrigger>
          </TabsList>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Leads Over Time</CardTitle>
                  <CardDescription>New leads created per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={leadStats?.byDay || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Leads" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lead Status Breakdown</CardTitle>
                  <CardDescription>Current distribution by status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadStats?.byStatus || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {(leadStats?.byStatus || []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Top Lead Sources</CardTitle>
                  <CardDescription>Where your leads are coming from</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadStats?.bySource || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Leads" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals" className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <StatCard icon={Target} label="Total Deals" value={dealStats?.total || 0} />
              <StatCard icon={DollarSign} label="Won Revenue" value={`$${((dealStats?.wonValue || 0) / 1000).toFixed(1)}k`} />
              <StatCard icon={DollarSign} label="Avg Deal Size" value={`$${(dealStats?.avgDealSize || 0).toLocaleString()}`} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deals by Stage</CardTitle>
                <CardDescription>Count and value per pipeline stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dealStats?.byStage || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="hsl(var(--primary))" name="Deals" />
                      <Bar dataKey="value" fill="#10b981" name="Value ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outreach Tab */}
          <TabsContent value="outreach" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Communication by Type</CardTitle>
                  <CardDescription>Emails, calls, SMS breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={commStats?.byType || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {(commStats?.byType || []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
                  <CardTitle className="text-base">Sentiment Analysis</CardTitle>
                  <CardDescription>How your outreach is being received</CardDescription>
                </CardHeader>
                <CardContent>
                  {(commStats?.bySentiment || []).length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={commStats?.bySentiment || []}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#8b5cf6" name="Messages" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                      No sentiment data available yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Mail className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="font-medium">Total Communications</p>
                    <p className="text-2xl font-bold">{commStats?.total || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
