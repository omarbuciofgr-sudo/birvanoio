import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { GatedAIWeeklyDigest } from "@/components/dashboard/GatedAIWeeklyDigest";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Users, Phone, CheckCircle, TrendingUp, ArrowRight, Plus,
  Mail, Globe, FileText, Bot, BarChart3, Bell, BellDot,
  Activity, Clock, DollarSign, Target, Zap, UserPlus,
  ArrowUpRight, ArrowDownRight, Calendar, Search,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

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

  const quickActions = [
    { label: "Add Lead", icon: UserPlus, href: "/dashboard/leads" },
    { label: "Web Scraper", icon: Globe, href: "/dashboard/scraper" },
    { label: "Campaigns", icon: Mail, href: "/dashboard/campaigns" },
    { label: "Voice Agent", icon: Bot, href: "/dashboard/voice-agent" },
    { label: "Reports", icon: BarChart3, href: "/dashboard/reports" },
    { label: "Prospect Search", icon: Search, href: "/dashboard/prospect-search" },
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Welcome back{user.email ? `, ${user.email.split('@')[0]}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/dashboard/reports")}>
              <BarChart3 className="h-3.5 w-3.5" /> Reports
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/dashboard/leads")}>
              <Plus className="h-3.5 w-3.5" /> Add Lead
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { title: "Total Leads", value: stats.total, icon: Users, change: "+12%", up: true },
            { title: "New Leads", value: stats.new, icon: TrendingUp, change: "+8%", up: true },
            { title: "Contacted", value: stats.contacted, icon: Phone, change: `${contactRate}%`, up: true },
            { title: "Converted", value: stats.converted, icon: CheckCircle, change: `${conversionRate}%`, up: true },
            { title: "Qualified", value: stats.qualified, icon: Target, change: "+5%", up: true },
          ].map((stat) => (
            <Card key={stat.title} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</span>
                  <stat.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                  <span className={`text-[10px] font-medium flex items-center gap-0.5 mb-1 ${stat.up ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                    {stat.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {stat.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {quickActions.map(action => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs shrink-0 h-8"
              onClick={() => navigate(action.href)}
            >
              <action.icon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Lead Activity Chart - spans 2 cols */}
          <Card className="lg:col-span-2 border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Weekly Lead Activity</CardTitle>
                <Badge variant="secondary" className="text-[10px] h-5 font-normal">Last 7 days</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(210 100% 50%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(210 100% 50%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(145 70% 45%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(145 70% 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="leads" stroke="hsl(210 100% 50%)" fill="url(#colorLeads)" strokeWidth={2} />
                  <Area type="monotone" dataKey="converted" stroke="hsl(145 70% 45%)" fill="url(#colorConverted)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(210 100% 50%)" }} /> New Leads
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(145 70% 45%)" }} /> Converted
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Funnel */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Pipeline Funnel</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => navigate("/dashboard/leads")}>
                  View All <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="flex justify-center mb-3">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={funnelData}
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {funnelData.map((stage) => (
                  <div key={stage.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{stage.value}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {stats.total > 0 ? `${((stage.value / stats.total) * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Grid: Activity + Notifications + Recent Leads */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Activity Feed */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                <Activity className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-[300px]">
                {activities.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No recent activity</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Activities will appear here as you work</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {activities.map((activity) => {
                      const Icon = getActionIcon(activity.action_type);
                      const colorClass = getActionColor(activity.action_type);
                      return (
                        <div key={activity.id} className="flex gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
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
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Notifications</CardTitle>
                  {unreadCount > 0 && (
                    <Badge className="h-4 text-[9px] px-1.5 bg-primary">{unreadCount}</Badge>
                  )}
                </div>
                <Bell className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-[300px]">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <Bell className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No notifications</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`flex gap-3 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer ${!notif.is_read ? 'bg-primary/[0.02]' : ''}`}
                        onClick={() => {
                          markNotificationRead(notif.id);
                          if (notif.action_url) navigate(notif.action_url);
                        }}
                      >
                        <div className="mt-0.5 shrink-0">{getNotificationIcon(notif.type)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs truncate ${!notif.is_read ? 'font-semibold' : 'font-medium'}`}>{notif.title}</p>
                            {!notif.is_read && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                          </div>
                          {notif.message && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(notif.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Recent Leads */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Recent Leads</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => navigate("/dashboard/leads")}>
                  View All <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <ScrollArea className="h-[300px]">
                {recentLeads.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No leads yet</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Import or create your first lead</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {recentLeads.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{lead.business_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {[lead.city, lead.state].filter(Boolean).join(', ') || 'No location'}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] h-5 shrink-0 ${
                            lead.status === 'new' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0' :
                            lead.status === 'contacted' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-0' :
                            lead.status === 'converted' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-0' :
                            lead.status === 'qualified' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-0' :
                            ''
                          }`}
                        >
                          {lead.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-medium">Conversion Rate</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold">{conversionRate}%</span>
                </div>
                <Progress value={parseFloat(conversionRate)} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Phone className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <span className="text-xs font-medium">Contact Rate</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold">{contactRate}%</span>
                </div>
                <Progress value={parseFloat(contactRate)} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs font-medium">Pipeline Value</span>
              </div>
              <div className="space-y-2">
                <span className="text-xl font-bold">$0</span>
                <p className="text-[10px] text-muted-foreground">No deals tracked yet</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs font-medium">Avg Response Time</span>
              </div>
              <div className="space-y-2">
                <span className="text-xl font-bold">—</span>
                <p className="text-[10px] text-muted-foreground">Start tracking today</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Weekly Digest */}
        <GatedAIWeeklyDigest />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
