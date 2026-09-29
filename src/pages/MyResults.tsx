import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DataPageSkeleton from "@/components/dashboard/DataPageSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLeadsData, type AppLead } from "@/hooks/useLeadsData";
import { supabase } from "@/integrations/supabase/client";

type L = AppLead & { appointment_set_at?: string | null; listing_signed_at?: string | null; estimated_commission?: number | null };

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");

const isContacted = (l: L) => !!l.contacted_at || ["contacted", "appointment_set", "listing_signed", "qualified", "converted"].includes(l.status);
const isAppt = (l: L) => !!l.appointment_set_at || ["appointment_set", "listing_signed"].includes(l.status);
const isSigned = (l: L) => l.status === "listing_signed";

export default function MyResults() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data = [], isLoading } = useLeadsData(user?.id);
  const leads = data as L[];
  const [found, setFound] = useState<{ all: number; month: number } | null>(null);

  const monthStart = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }, []);

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("owner_search_results").select("id", { count: "exact", head: true }),
      supabase.from("owner_search_results").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    ]).then(([a, m]) => setFound({ all: a.count ?? 0, month: m.count ?? 0 }));
  }, [user, monthStart]);

  const stats = useMemo(() => {
    const inMonth = (d?: string | null) => !!d && new Date(d) >= monthStart;
    const contacted = leads.filter(isContacted);
    const appts = leads.filter(isAppt);
    const signed = leads.filter(isSigned);
    const commission = signed.reduce((s, l) => s + Number(l.estimated_commission ?? 0), 0);
    const months: { month: string; listings: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const count = signed.filter((l) => {
        const s = new Date(l.listing_signed_at ?? l.updated_at);
        return s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth();
      }).length;
      months.push({ month: d.toLocaleDateString("en-US", { month: "short" }), listings: count });
    }
    return {
      contacted: { all: contacted.length, month: contacted.filter((l) => inMonth(l.contacted_at)).length },
      appts: { all: appts.length, month: appts.filter((l) => inMonth(l.appointment_set_at)).length },
      signed: { all: signed.length, month: signed.filter((l) => inMonth(l.listing_signed_at)).length },
      commission,
      missingPrice: signed.filter((l) => l.estimated_commission == null).length,
      months,
    };
  }, [leads, monthStart]);

  if (loading || isLoading || !found) return <DataPageSkeleton />;

  const totals = [
    { label: "Owners found", ...found },
    { label: "Owners contacted", ...stats.contacted },
    { label: "Appointments set", ...stats.appts },
    { label: "Listings signed", ...stats.signed },
  ];
  const funnel = [
    { label: "Contacted", value: stats.contacted.all, rate: "100%" },
    { label: "Appointment set", value: stats.appts.all, rate: pct(stats.appts.all, stats.contacted.all) },
    { label: "Listing signed", value: stats.signed.all, rate: pct(stats.signed.all, stats.appts.all) },
  ];
  const max = Math.max(stats.contacted.all, 1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Results</h1>
          <p className="text-sm text-muted-foreground">What your Brivano leads have turned into.</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Estimated commission from Brivano leads</p>
            <p className="text-4xl font-bold tracking-tight mt-1">{money(stats.commission)}</p>
            {stats.missingPrice > 0 && (
              <p className="text-xs text-muted-foreground mt-2">{stats.missingPrice} signed listing{stats.missingPrice > 1 ? "s have" : " has"} no list price yet, so {stats.missingPrice > 1 ? "they aren't" : "it isn't"} counted.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {totals.map((t) => (
            <Card key={t.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-2xl font-semibold mt-1">{t.month.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">this month · {t.all.toLocaleString()} all time</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Listings signed by month</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.months}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} width={28} />
                  <Tooltip />
                  <Bar dataKey="listings" name="Listings signed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversion funnel</CardTitle>
              <CardDescription>All time. Percent is from the step before.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnel.map((f) => (
                <div key={f.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{f.label}</span>
                    <span className="text-muted-foreground">{f.value.toLocaleString()} · {f.rate}</span>
                  </div>
                  <div className="h-3 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(f.value / max) * 100}%` }} />
                  </div>
                </div>
              ))}
              {stats.contacted.all === 0 && (
                <p className="text-sm text-muted-foreground">No contacted owners yet. <Link className="text-primary underline" to="/dashboard/scraper?tab=real-estate">Find owners</Link> to get started.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <Button variant="outline" size="sm" asChild><Link to="/dashboard/leads">Go to My Leads</Link></Button>
      </div>
    </DashboardLayout>
  );
}
