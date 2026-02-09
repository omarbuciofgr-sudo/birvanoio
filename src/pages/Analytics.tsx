import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "recharts";
import type { Database } from "@/integrations/supabase/types";
import { AINLReports } from "@/components/dashboard/AINLReports";
import { AIAnomalyDetection } from "@/components/dashboard/AIAnomalyDetection";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const Analytics = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*");

    if (!error && data) {
      setLeads(data);
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

  // Calculate status distribution
  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const COLORS = {
    New: "hsl(190, 100%, 50%)",
    Contacted: "hsl(45, 100%, 50%)",
    Qualified: "hsl(280, 100%, 60%)",
    Converted: "hsl(145, 70%, 50%)",
    Lost: "hsl(0, 72%, 51%)",
  };

  // Calculate leads by week
  const leadsByWeek = leads.reduce((acc, lead) => {
    const date = new Date(lead.created_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().split("T")[0];
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(leadsByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([date, count]) => ({
      week: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      leads: count,
    }));

  // Calculate conversion rate
  const conversionRate = leads.length > 0
    ? ((statusCounts.converted || 0) / leads.length * 100).toFixed(1)
    : "0";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your lead performance and conversions</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Leads</span>
              <div className="text-2xl font-bold mt-1">{leads.length}</div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Conversion Rate</span>
              <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{conversionRate}%</div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Converted</span>
              <div className="text-2xl font-bold mt-1">{statusCounts.converted || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Leads Over Time */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-medium">Leads Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="week"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-medium">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[entry.name as keyof typeof COLORS] || "hsl(var(--muted))"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Analytics Section */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-medium">Natural Language Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <AINLReports />
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-5 pt-4">
              <CardTitle className="text-sm font-medium">Anomaly Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <AIAnomalyDetection />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;
