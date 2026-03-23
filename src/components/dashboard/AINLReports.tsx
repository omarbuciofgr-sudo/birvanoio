import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, BarChart3, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { toast } from "sonner";

interface ReportResponse {
  answer: string;
  chart_data?: { label: string; value: number }[];
  chart_type: string;
  key_metrics?: { label: string; value: string; trend?: string }[];
}

const COLORS = ["hsl(210 100% 50%)", "hsl(145 70% 45%)", "hsl(45 100% 50%)", "hsl(280 100% 55%)", "hsl(0 72% 51%)"];

export const AINLReports = () => {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ReportResponse | null>(null);

  const ask = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-nl-reports", {
        body: { query },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> AI Reports — Ask Anything
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-3">
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder='e.g. "conversion rate by industry last month"' className="text-sm h-9" />
          <Button onClick={ask} disabled={loading} size="sm" className="gap-1.5 shrink-0">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Ask
          </Button>
        </div>

        {result && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm text-muted-foreground">{result.answer}</p>

            {result.key_metrics && result.key_metrics.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {result.key_metrics.map((m, i) => (
                  <div key={i} className="text-center p-2 rounded-lg bg-secondary/30">
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-bold">{m.value}</p>
                    {m.trend && (
                      <Badge variant="outline" className={`text-[9px] ${m.trend === 'up' ? 'text-green-500' : m.trend === 'down' ? 'text-red-500' : ''}`}>
                        {m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'} {m.trend}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.chart_data && result.chart_data.length > 0 && result.chart_type !== "none" && (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  {result.chart_type === "pie" ? (
                    <PieChart>
                      <Pie data={result.chart_data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {result.chart_data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  ) : result.chart_type === "line" ? (
                    <LineChart data={result.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  ) : (
                    <BarChart data={result.chart_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
