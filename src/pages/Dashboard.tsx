import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { GatedAIWeeklyDigest } from "@/components/dashboard/GatedAIWeeklyDigest";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Phone, CheckCircle, TrendingUp } from "lucide-react";

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  converted: number;
}

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<LeadStats>({ total: 0, new: 0, contacted: 0, converted: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentLeads();
    }
  }, [user]);

  const fetchStats = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("status");

    if (!error && data) {
      setStats({
        total: data.length,
        new: data.filter((l) => l.status === "new").length,
        contacted: data.filter((l) => l.status === "contacted").length,
        converted: data.filter((l) => l.status === "converted").length,
      });
    }
  };

  const fetchRecentLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!error && data) {
      setRecentLeads(data);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const statCards = [
    { title: "Total Leads", value: stats.total, icon: Users, color: "text-primary" },
    { title: "New Leads", value: stats.new, icon: TrendingUp, color: "text-status-new" },
    { title: "Contacted", value: stats.contacted, icon: Phone, color: "text-status-contacted" },
    { title: "Converted", value: stats.converted, icon: CheckCircle, color: "text-status-converted" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your lead overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Leads */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No leads yet. Your leads will appear here once delivered.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                  >
                    <div>
                      <p className="font-medium text-foreground">{lead.business_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.city}, {lead.state}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        lead.status === "new"
                          ? "bg-status-new/20 text-status-new"
                          : lead.status === "contacted"
                          ? "bg-status-contacted/20 text-status-contacted"
                          : lead.status === "converted"
                          ? "bg-status-converted/20 text-status-converted"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Weekly Digest */}
        <GatedAIWeeklyDigest />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
