import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Compass, Sparkles } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PERSONA_ROLES } from "@/lib/persona";
import { goalChartRows, roleChartRows, MIN_SAMPLE } from "@/lib/analytics/personaAnalytics";
import { usePersonaAnalytics } from "@/hooks/usePersonaAnalytics";
import RecommendationExperimentCard from "@/components/analytics/RecommendationExperimentCard";

export const PersonaPerformanceCard = () => {
  const { analytics, recommendations, isLoading } = usePersonaAnalytics();
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const roles = roleChartRows(analytics);
  const goals = goalChartRows(analytics, roleFilter === "all" ? null : roleFilter);

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Compass className="h-4 w-4 text-primary" />
              Conversion by role
            </CardTitle>
            <CardDescription>
              How each persona cohort activates and converts. {analytics.total_users} profiles with a
              role selected.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={roles}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis unit="%" fontSize={11} />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    return `${label} — ${row?.users ?? 0} users`;
                  }}
                />
                <Legend />
                <Bar dataKey="activation" name="Activated" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversion" name="Converted" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Conversion by workspace focus</CardTitle>
            <CardDescription>
              Which goal selections lead to converted leads and won deals.
            </CardDescription>
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-8 w-[190px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[9999]">
              <SelectItem value="all">All roles</SelectItem>
              {PERSONA_ROLES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No goal data yet. Rates appear once people pick a focus and start converting leads.
            </p>
          ) : (
            goals.map((g) => (
              <div key={`${g.role}-${g.id}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{g.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {g.users < MIN_SAMPLE && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        low sample
                      </Badge>
                    )}
                    {g.users} users · {g.conversion}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, g.conversion)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Recommendations for your workspace
          </CardTitle>
          <CardDescription>Based on what works for similar accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!recommendations.hasEnoughData ? (
            <p className="text-muted-foreground">
              Not enough data yet — recommendations unlock once cohorts reach {MIN_SAMPLE} users.
            </p>
          ) : (
            <>
              {recommendations.currentRoleRate !== null && (
                <p className="text-muted-foreground">
                  Your role cohort converts at{" "}
                  <span className="text-foreground font-medium">
                    {Math.round(recommendations.currentRoleRate * 100)}%
                  </span>
                  .
                </p>
              )}
              {recommendations.suggestedRole && (
                <p>
                  Accounts set to{" "}
                  <span className="font-medium">{recommendations.suggestedRole.label}</span> convert at{" "}
                  {Math.round(recommendations.suggestedRole.rate * 100)}% — worth switching if it
                  describes your work.
                </p>
              )}
              {recommendations.suggestedGoals.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-muted-foreground">Add these goals to unlock higher-converting tools:</p>
                  {recommendations.suggestedGoals.map((g) => (
                    <div key={g.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                      <span>{g.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(g.rate * 100)}% · {g.users} users
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                !recommendations.suggestedRole && (
                  <p className="text-muted-foreground">
                    Your current focus is already among the best performing setups.
                  </p>
                )
              )}
            </>
          )}
        </CardContent>
      </Card>

      <RecommendationExperimentCard />
    </div>
  );
};

export default PersonaPerformanceCard;
