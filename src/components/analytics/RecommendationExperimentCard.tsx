import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FlaskConical, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { usePersonaAnalytics } from "@/hooks/usePersonaAnalytics";
import { MIN_ARM_SAMPLE } from "@/lib/analytics/personaExperiment";

/**
 * A/B test results: which persona recommendation strategy actually lifts
 * conversion rates. Users are bucketed deterministically into one arm.
 */
export const RecommendationExperimentCard = () => {
  const { experimentSummary, experiment, experimentLoading, variant, strategy } =
    usePersonaAnalytics();

  const chartData = experimentSummary.rows.map((r) => ({
    name: r.label.split(" — ")[0],
    applied: r.applyPct,
    conversion: r.conversionPct,
    users: r.users,
  }));

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-primary" />
          Recommendation strategy A/B test
        </CardTitle>
        <CardDescription>
          {experiment.total_exposed} accounts have seen a suggestion. You are in the{" "}
          <span className="text-foreground font-medium">{strategy.label}</span> arm ({variant}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {experimentLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis unit="%" fontSize={11} />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                  labelFormatter={(label, payload) =>
                    `${label} — ${payload?.[0]?.payload?.users ?? 0} exposed`
                  }
                />
                <Legend />
                <Bar dataKey="applied" name="Applied suggestion" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversion" name="Converted after" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              {experimentSummary.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm">
                      {row.label}
                      {row.isControl && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          control
                        </Badge>
                      )}
                      {row.users < MIN_ARM_SAMPLE && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          low sample
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{row.description}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>
                      {row.users} exposed · {row.applyPct}% applied
                    </p>
                    <p className="text-foreground">
                      {row.conversionPct}% converted
                      {row.lift !== null && (
                        <span className={row.lift >= 0 ? "text-primary" : "text-destructive"}>
                          {" "}
                          ({row.lift >= 0 ? "+" : ""}
                          {row.lift}pp)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              {!experimentSummary.hasEnoughData ? (
                <p className="text-muted-foreground">
                  Still gathering data — a winner is called once each arm reaches{" "}
                  {MIN_ARM_SAMPLE} exposed accounts.
                </p>
              ) : experimentSummary.leader ? (
                <p className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>
                    <span className="font-medium">{experimentSummary.leader.label}</span> is leading
                    the control by {experimentSummary.leader.lift}pp on conversion.
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  No challenger beats the control yet — keep the current strategy.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RecommendationExperimentCard;
