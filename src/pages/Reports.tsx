import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { isOptionalTableMissing, markOptionalTableMissingOnError } from "../integrations/supabase/optionalTables";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BarChart3, TrendingUp, Phone, Mail, DollarSign, Clock,
  Plus, Save, Share2, Trash2, FileText, Users, Target,
  ArrowUpRight, ArrowDownRight, Calendar, Download,
  PieChart as PieChartIcon, Activity, Loader2, CheckCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import { AINLReports } from "@/components/dashboard/AINLReports";
import { AIAnomalyDetection } from "@/components/dashboard/AIAnomalyDetection";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  config: any;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

const CHART_COLORS = [
  "hsl(210 100% 50%)",
  "hsl(145 70% 45%)",
  "hsl(45 100% 50%)",
  "hsl(280 100% 55%)",
  "hsl(0 72% 51%)",
  "hsl(195 100% 45%)",
];

const generateMockPerformanceData = () => {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  return days.map(day => ({
    date: day,
    calls: Math.floor(Math.random() * 30) + 5,
    emails: Math.floor(Math.random() * 40) + 10,
    sms: Math.floor(Math.random() * 15) + 2,
    conversions: Math.floor(Math.random() * 8) + 1,
    revenue: Math.floor(Math.random() * 5000) + 500,
  }));
};

const generateMockConversionData = () => [
  { stage: "New", count: 245, rate: 100 },
  { stage: "Contacted", count: 182, rate: 74 },
  { stage: "Qualified", count: 98, rate: 40 },
  { stage: "Proposal", count: 52, rate: 21 },
  { stage: "Converted", count: 31, rate: 13 },
];

const generateMockTeamData = () => [
  { name: "You", calls: 45, emails: 67, conversions: 12, revenue: 24500, responseTime: 22 },
  { name: "Team Avg", calls: 32, emails: 48, conversions: 8, revenue: 18200, responseTime: 35 },
];

const ANALYTICS_COLORS: Record<string, string> = {
  New: "hsl(190, 100%, 50%)",
  Contacted: "hsl(45, 100%, 50%)",
  Qualified: "hsl(280, 100%, 60%)",
  Converted: "hsl(145, 70%, 50%)",
  Lost: "hsl(0, 72%, 51%)",
};

export default function Reports() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newReportName, setNewReportName] = useState("");
  const [newReportDesc, setNewReportDesc] = useState("");
  const [newReportType, setNewReportType] = useState("custom");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["calls", "emails", "conversions"]);
  const [dateRange, setDateRange] = useState("14d");
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);

  // Analytics data
  const [leads, setLeads] = useState<Lead[]>([]);

  const performanceData = generateMockPerformanceData();
  const conversionData = generateMockConversionData();
  const teamData = generateMockTeamData();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      fetchReports();
      fetchLeads();
    }
  }, [user]);

  const fetchLeads = async () => {
    const { data, error } = await supabase.from("leads").select("*");
    if (!error && data) setLeads(data);
  };

  const REPORTS_TABLE = "custom_reports";
  const fetchReports = async () => {
    setLoadingReports(true);
    if (isOptionalTableMissing(REPORTS_TABLE)) {
      setSavedReports([]);
      setLoadingReports(false);
      return;
    }
    const { data, error } = await supabase.from(REPORTS_TABLE).select("*").order("updated_at", { ascending: false });
    if (error) {
      markOptionalTableMissingOnError(REPORTS_TABLE, error);
      setSavedReports([]);
    } else if (data) setSavedReports(data);
    setLoadingReports(false);
  };

  const handleCreateReport = async () => {
    if (!newReportName.trim()) { toast.error("Please enter a report name"); return; }
    if (!user?.id) return;
    if (isOptionalTableMissing(REPORTS_TABLE)) { setSaving(false); return; }
    setSaving(true);
    const { error } = await supabase.from(REPORTS_TABLE).insert({
      user_id: user.id, name: newReportName, description: newReportDesc || null,
      report_type: newReportType, config: { metrics: selectedMetrics, dateRange, filters: {} }, is_shared: isShared,
    });
    if (error) {
      markOptionalTableMissingOnError(REPORTS_TABLE, error);
      setSaving(false);
      return;
    }
    toast.success("Report created");
    setCreateDialogOpen(false);
    setNewReportName("");
    setNewReportDesc("");
    setSelectedMetrics(["calls", "emails", "conversions"]);
    fetchReports();
    setSaving(false);
  };

  const handleDeleteReport = async (id: string) => {
    if (isOptionalTableMissing(REPORTS_TABLE)) return;
    const { error } = await supabase.from(REPORTS_TABLE).delete().eq("id", id);
    if (error) markOptionalTableMissingOnError(REPORTS_TABLE, error);
    else { setSavedReports(prev => prev.filter(r => r.id !== id)); toast.success("Report deleted"); }
  };

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]);
  };

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!user) return null;

  // Analytics computed data
  const statusCounts = leads.reduce((acc, lead) => { acc[lead.status] = (acc[lead.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  const conversionRate = leads.length > 0 ? ((statusCounts.converted || 0) / leads.length * 100).toFixed(1) : "0";

  const leadsByWeek = leads.reduce((acc, lead) => {
    const date = new Date(lead.created_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().split("T")[0];
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(leadsByWeek).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([date, count]) => ({
    week: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), leads: count,
  }));

  const availableMetrics = [
    { key: "calls", label: "Calls Made", icon: Phone },
    { key: "emails", label: "Emails Sent", icon: Mail },
    { key: "sms", label: "SMS Sent", icon: FileText },
    { key: "conversions", label: "Conversions", icon: CheckCircle },
    { key: "revenue", label: "Revenue", icon: DollarSign },
    { key: "responseTime", label: "Response Time", icon: Clock },
  ];

  const reportTemplates = [
    { type: "outreach", label: "Outreach Volume", desc: "Track calls, emails, and SMS activity", icon: Phone, color: "text-blue-500 bg-blue-500/10" },
    { type: "conversion", label: "Conversion Funnel", desc: "Analyze lead progression", icon: TrendingUp, color: "text-green-500 bg-green-500/10" },
    { type: "revenue", label: "Revenue & Deals", desc: "Monitor pipeline value", icon: DollarSign, color: "text-yellow-500 bg-yellow-500/10" },
    { type: "response_time", label: "Response Time", desc: "Measure response speed", icon: Clock, color: "text-purple-500 bg-purple-500/10" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Performance insights, analytics, and custom reports</p>
          </div>
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Build Report
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-9 p-0.5 bg-muted/60">
            <TabsTrigger value="overview" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BarChart3 className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <TrendingUp className="h-3.5 w-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="outreach" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Phone className="h-3.5 w-3.5" /> Outreach
            </TabsTrigger>
            <TabsTrigger value="conversions" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Target className="h-3.5 w-3.5" /> Conversions
            </TabsTrigger>
            <TabsTrigger value="saved" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Save className="h-3.5 w-3.5" /> Saved
              {savedReports.length > 0 && <Badge variant="secondary" className="text-[9px] h-4 ml-1">{savedReports.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Outreach", value: "312", change: "+18%", up: true, icon: Activity, color: "text-blue-500 bg-blue-500/10" },
                { label: "Conversion Rate", value: "12.7%", change: "+2.3%", up: true, icon: TrendingUp, color: "text-green-500 bg-green-500/10" },
                { label: "Avg Deal Size", value: "$2,450", change: "-5%", up: false, icon: DollarSign, color: "text-yellow-500 bg-yellow-500/10" },
                { label: "Avg Response", value: "22 min", change: "-8 min", up: true, icon: Clock, color: "text-purple-500 bg-purple-500/10" },
              ].map(metric => (
                <Card key={metric.label} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${metric.color}`}>
                        <metric.icon className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">{metric.label}</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-bold">{metric.value}</span>
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 mb-0.5 ${metric.up ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                        {metric.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                        {metric.change}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border/40">
              <CardHeader className="pb-2 px-5 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Performance Overview</CardTitle>
                  <Badge variant="secondary" className="text-[10px] h-5 font-normal">Last 14 days</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={performanceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                    <Bar dataKey="calls" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="emails" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="conversions" fill={CHART_COLORS[2]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-2 px-5 pt-4">
                <CardTitle className="text-sm font-medium">Your Performance vs. Team Average</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { label: "Calls", you: teamData[0].calls, avg: teamData[1].calls },
                    { label: "Emails", you: teamData[0].emails, avg: teamData[1].emails },
                    { label: "Conversions", you: teamData[0].conversions, avg: teamData[1].conversions },
                    { label: "Revenue", you: teamData[0].revenue, avg: teamData[1].revenue, isCurrency: true },
                    { label: "Response", you: teamData[0].responseTime, avg: teamData[1].responseTime, lowerIsBetter: true },
                  ].map(metric => {
                    const isAbove = metric.lowerIsBetter ? metric.you < metric.avg : metric.you > metric.avg;
                    return (
                      <div key={metric.label} className="text-center space-y-2">
                        <p className="text-[10px] text-muted-foreground font-medium">{metric.label}</p>
                        <p className={`text-lg font-bold ${isAbove ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                          {metric.isCurrency ? `$${(metric.you / 1000).toFixed(1)}k` : metric.you}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Avg: {metric.isCurrency ? `$${(metric.avg / 1000).toFixed(1)}k` : metric.avg}
                        </p>
                        <Progress value={Math.min(100, (metric.you / Math.max(metric.avg, 1)) * 100)} className="h-1" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-sm font-medium mb-3">Quick Report Templates</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {reportTemplates.map(tpl => (
                  <Card key={tpl.type} className="border-border/40 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                    onClick={() => { setNewReportType(tpl.type); setNewReportName(tpl.label); setNewReportDesc(tpl.desc); setCreateDialogOpen(true); }}>
                    <CardContent className="p-4">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-3 ${tpl.color}`}>
                        <tpl.icon className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-semibold">{tpl.label}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{tpl.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab (merged from Analytics page) */}
          <TabsContent value="analytics" className="space-y-4 mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Leads</span>
                  <div className="text-2xl font-bold mt-1">{leads.length}</div>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Conversion Rate</span>
                  <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{conversionRate}%</div>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Converted</span>
                  <div className="text-2xl font-bold mt-1">{statusCounts.converted || 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/40">
                <CardHeader className="pb-2 px-5 pt-4"><CardTitle className="text-sm font-medium">Leads Over Time</CardTitle></CardHeader>
                <CardContent>
                  {barData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No data available yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                        <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardHeader className="pb-2 px-5 pt-4"><CardTitle className="text-sm font-medium">Status Distribution</CardTitle></CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No data available yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={ANALYTICS_COLORS[entry.name] || "hsl(var(--muted))"} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="border-border/40">
                <CardHeader className="pb-2 px-5 pt-4"><CardTitle className="text-sm font-medium">Natural Language Reports</CardTitle></CardHeader>
                <CardContent><AINLReports /></CardContent>
              </Card>
              <Card className="border-border/40">
                <CardHeader className="pb-2 px-5 pt-4"><CardTitle className="text-sm font-medium">Anomaly Detection</CardTitle></CardHeader>
                <CardContent><AIAnomalyDetection /></CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Outreach Tab */}
          <TabsContent value="outreach" className="space-y-4 mt-0">
            <Card className="border-border/40">
              <CardHeader className="pb-2 px-5 pt-4"><CardTitle className="text-sm font-medium">Outreach Activity Over Time</CardTitle></CardHeader>
              <CardContent className="px-5 pb-4">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      {["calls", "emails", "sms"].map((key, i) => (
                        <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                    <Area type="monotone" dataKey="calls" stroke={CHART_COLORS[0]} fill={`url(#grad-calls)`} strokeWidth={2} />
                    <Area type="monotone" dataKey="emails" stroke={CHART_COLORS[1]} fill={`url(#grad-emails)`} strokeWidth={2} />
                    <Area type="monotone" dataKey="sms" stroke={CHART_COLORS[2]} fill={`url(#grad-sms)`} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversions Tab */}
          <TabsContent value="conversions" className="space-y-4 mt-0">
            <Card className="border-border/40">
              <CardHeader className="pb-2 px-5 pt-4"><CardTitle className="text-sm font-medium">Conversion Funnel</CardTitle></CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-3">
                  {conversionData.map((stage, i) => (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{stage.stage}</span>
                        <span className="text-xs text-muted-foreground">{stage.count} · {stage.rate}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-8 overflow-hidden">
                        <div className="h-full rounded-full flex items-center px-3 transition-all" style={{ width: `${stage.rate}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}>
                          <span className="text-[10px] font-bold text-white">{stage.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Saved Reports Tab */}
          <TabsContent value="saved" className="space-y-4 mt-0">
            {loadingReports ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : savedReports.length === 0 ? (
              <Card className="border-border/40">
                <CardContent className="p-12 text-center">
                  <Save className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium">No saved reports</p>
                  <p className="text-xs text-muted-foreground mt-1">Create a custom report to get started</p>
                  <Button size="sm" className="mt-4 gap-1.5 text-xs" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Build Report
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedReports.map(report => (
                  <Card key={report.id} className="border-border/40 hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold truncate">{report.name}</h4>
                          {report.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{report.description}</p>}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive shrink-0" onClick={() => handleDeleteReport(report.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="outline" className="text-[10px]">{report.report_type}</Badge>
                        {report.is_shared && <Badge variant="secondary" className="text-[10px]"><Share2 className="h-2.5 w-2.5 mr-0.5" /> Shared</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Report Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Build Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={newReportName} onChange={(e) => setNewReportName(e.target.value)} placeholder="Report name" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={newReportDesc} onChange={(e) => setNewReportDesc(e.target.value)} placeholder="Optional description" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Metrics</Label>
                <div className="grid grid-cols-3 gap-2">
                  {availableMetrics.map(m => (
                    <label key={m.key} className="flex items-center gap-2 p-2 rounded-md border border-border/60 cursor-pointer hover:bg-muted/30">
                      <Checkbox checked={selectedMetrics.includes(m.key)} onCheckedChange={() => toggleMetric(m.key)} />
                      <div className="flex items-center gap-1.5"><m.icon className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{m.label}</span></div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isShared} onCheckedChange={setIsShared} />
                <span className="text-xs">Share with team</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateReport} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Report"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
