import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { GatedAIWeeklyDigest } from "@/components/dashboard/GatedAIWeeklyDigest";
import { AIDealForecast } from "@/components/dashboard/AIDealForecast";
import { AISmartPriority } from "@/components/dashboard/AISmartPriority";
import { AIChurnDetection } from "@/components/dashboard/AIChurnDetection";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Users, Phone, CheckCircle, TrendingUp, ArrowRight, Plus,
  Mail, Globe, FileText, Bot, BarChart3, Bell, BellDot,
  Activity, Clock, DollarSign, Target, Zap, UserPlus,
  ArrowUpRight, ArrowDownRight, Calendar, Search,
  Sparkles, Eye, MousePointer,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import OnboardingTour from "@/components/dashboard/OnboardingTour";

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  converted: number;
  qualified: number;
}

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  category: string | null;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

interface ActivityItem {
  id: string;
  action_type: string;
  description: string | null;
  created_at: string;
  metadata: any;
}

const FUNNEL_COLORS = [
  "hsl(210 100% 50%)",
  "hsl(45 100% 50%)",
  "hsl(280 100% 55%)",
  "hsl(145 70% 45%)",
];

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<LeadStats>({ total: 0, new: 0, contacted: 0, converted: 0, qualified: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentLeads();
      fetchNotifications();
      fetchActivities();
      generateWeeklyData();
    }
  }, [user]);

  const fetchStats = async () => {
    const { data, error } = await supabase.from("leads").select("status");
    if (!error && data) {
      setStats({
        total: data.length,
        new: data.filter((l) => l.status === "new").length,
        contacted: data.filter((l) => l.status === "contacted").length,
        converted: data.filter((l) => l.status === "converted").length,
        qualified: data.filter((l) => l.status === "qualified").length,
      });
    }
  };

  const fetchRecentLeads = async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(5);
    if (data) setRecentLeads(data);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(10);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const fetchActivities = async () => {
    const { data } = await supabase.from("team_activity_log").select("*").order("created_at", { ascending: false }).limit(8);
    if (data) setActivities(data);
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const generateWeeklyData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    setWeeklyData(days.map(day => ({
      day,
      leads: Math.floor(Math.random() * 20) + 5,
      contacted: Math.floor(Math.random() * 15) + 2,
      converted: Math.floor(Math.random() * 8) + 1,
    })));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const conversionRate = stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : "0";
  const contactRate = stats.total > 0 ? ((stats.contacted / stats.total) * 100).toFixed(1) : "0";

  const funnelData = [
    { name: "New", value: stats.new, color: FUNNEL_COLORS[0] },
    { name: "Contacted", value: stats.contacted, color: FUNNEL_COLORS[1] },
    { name: "Qualified", value: stats.qualified, color: FUNNEL_COLORS[2] },
    { name: "Converted", value: stats.converted, color: FUNNEL_COLORS[3] },
  ];

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'call': return Phone;
      case 'email': return Mail;
      case 'sms': return FileText;
      case 'conversion': return CheckCircle;
      case 'lead_created': return UserPlus;
      default: return Activity;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'call': return 'text-blue-500 bg-blue-500/10';
      case 'email': return 'text-purple-500 bg-purple-500/10';
      case 'conversion': return 'text-green-500 bg-green-500/10';
      case 'lead_created': return 'text-primary bg-primary/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case 'warning': return <Zap className="h-3.5 w-3.5 text-yellow-500" />;
      case 'alert': return <BellDot className="h-3.5 w-3.5 text-destructive" />;
      default: return <Bell className="h-3.5 w-3.5 text-primary" />;
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const statusColors: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    contacted: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    qualified: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    converted: "bg-green-500/10 text-green-600 dark:text-green-400",
    lost: "bg-destructive/10 text-destructive",
  };

  // Quick actions for executive shortcuts
  const quickActions = [
    { label: "Find Prospects", icon: Search, href: "/dashboard/scraper", color: "text-primary bg-primary/10" },
    { label: "New Campaign", icon: Mail, href: "/dashboard/campaigns", color: "text-purple-500 bg-purple-500/10" },
    { label: "View Reports", icon: BarChart3, href: "/dashboard/reports", color: "text-green-500 bg-green-500/10" },
    { label: "Voice Agent", icon: Bot, href: "/dashboard/voice-agent", color: "text-yellow-500 bg-yellow-500/10" },
  ];

  return (
    <DashboardLayout>
      <OnboardingTour />
      <div className="space-y-6">
        {/* Executive Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}{user.email ? `, ${user.email.split('@')[0]}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Here's your pipeline summary for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => navigate("/dashboard/reports")}>
              <BarChart3 className="h-3.5 w-3.5" /> Reports
            </Button>
            <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => navigate("/dashboard/leads")}>
              <Plus className="h-3.5 w-3.5" /> Add Lead
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map(action => (
            <Link
              key={action.label}
              to={action.href}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-border/40 bg-card/80 hover:bg-card hover:shadow-md hover:border-border/80 transition-all group"
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${action.color} group-hover:scale-105 transition-transform`}>
                <action.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="text-xs font-semibold">{action.label}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors inline-block ml-1" />
              </div>
            </Link>
          ))}
        </div>

        {/* KPI Cards — Premium */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { title: "Total Leads", value: stats.total, icon: Users, change: "+12%", up: true, desc: "All time" },
            { title: "New This Week", value: stats.new, icon: TrendingUp, change: "+8%", up: true, desc: "vs last week" },
            { title: "Contact Rate", value: `${contactRate}%`, icon: Phone, change: "+3%", up: true, desc: `${stats.contacted} contacted` },
            { title: "In Pipeline", value: stats.qualified, icon: Target, change: "+5%", up: true, desc: "Qualified" },
            { title: "Win Rate", value: `${conversionRate}%`, icon: CheckCircle, change: "+1.2%", up: true, desc: `${stats.converted} won` },
          ].map((stat) => (
            <Card key={stat.title} className="border-border/40 bg-card/80 hover:shadow-md transition-all group cursor-default">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/[0.06] flex items-center justify-center group-hover:bg-primary/[0.1] transition-colors">
                    <stat.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className={`text-[10px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                    stat.up ? 'text-green-600 dark:text-green-400 bg-green-500/10' : 'text-destructive bg-destructive/10'
                  }`}>
                    {stat.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {stat.change}
                  </span>
                </div>
                <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.title} · {stat.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Grid — Chart + Pipeline */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Lead Activity Chart */}
          <Card className="lg:col-span-2 border-border/40">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Pipeline Activity</CardTitle>
                  <Badge variant="secondary" className="text-[10px] h-5 font-normal">7 days</Badge>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(210 100% 50%)" }} /> Leads
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(145 70% 45%)" }} /> Converted
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(210 100% 50%)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="hsl(210 100% 50%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(145 70% 45%)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="hsl(145 70% 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                  <Area type="monotone" dataKey="leads" stroke="hsl(210 100% 50%)" fill="url(#colorLeads)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="converted" stroke="hsl(145 70% 45%)" fill="url(#colorConverted)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pipeline Funnel */}
          <Card className="border-border/40">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => navigate("/dashboard/leads")}>
                  View <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="flex justify-center mb-4">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={funnelData} innerRadius={48} outerRadius={62} paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {funnelData.map((stage) => (
                  <div key={stage.name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{stage.value}</span>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">
                        {stats.total > 0 ? `${((stage.value / stats.total) * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Total pipeline</span>
                <span className="font-bold">{stats.total} leads</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Grid — Activity, Notifications, Recent */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Activity Feed */}
          <Card className="border-border/40">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Activity</CardTitle>
                <Activity className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-[280px]">
                {activities.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground/15" />
                    <p className="text-xs text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {activities.map((activity) => {
                      const Icon = getActionIcon(activity.action_type);
                      const colorClass = getActionColor(activity.action_type);
                      return (
                        <div key={activity.id} className="flex gap-3 px-5 py-3 hover:bg-muted/15 transition-colors">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{activity.description || activity.action_type}</p>
                            <p className="text-[10px] text-muted-foreground">{timeAgo(activity.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-border/40">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                  {unreadCount > 0 && (
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>
                  )}
                </div>
                <Bell className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-[280px]">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <Bell className="h-8 w-8 mx-auto mb-3 text-muted-foreground/15" />
                    <p className="text-xs text-muted-foreground">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-muted/15 ${!notification.is_read ? 'bg-primary/[0.02]' : ''}`}
                        onClick={() => {
                          markNotificationRead(notification.id);
                          if (notification.action_url) navigate(notification.action_url);
                        }}
                      >
                        <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs truncate ${!notification.is_read ? 'font-medium' : ''}`}>{notification.title}</p>
                          {notification.message && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{notification.message}</p>}
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{timeAgo(notification.created_at)}</p>
                        </div>
                        {!notification.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Recent Leads */}
          <Card className="border-border/40">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Recent Leads</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => navigate("/dashboard/leads")}>
                  View All <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-[280px]">
                {recentLeads.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground/15" />
                    <p className="text-xs text-muted-foreground">No leads yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {recentLeads.map((lead) => (
                      <Link
                        key={lead.id}
                        to="/dashboard/leads"
                        className="flex items-center gap-3 px-5 py-3 hover:bg-muted/15 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center shrink-0 ring-1 ring-border/30">
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {lead.business_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{lead.business_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {lead.contact_name || lead.email || 'No contact'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[lead.status] || ''}`}>
                          {lead.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights Section */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <h2 className="text-sm font-semibold">AI Insights</h2>
            <Badge variant="secondary" className="text-[9px] h-4 font-normal">Powered by AI</Badge>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <GatedAIWeeklyDigest />
            <AIDealForecast />
            <AISmartPriority />
            <AIChurnDetection />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
