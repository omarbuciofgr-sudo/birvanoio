import { useMemo } from "react";
import { CREDIT_COSTS } from "@/hooks/useCredits";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calculator, Shield, Zap } from "lucide-react";

interface JobCostEstimateProps {
  targetCount: number;
  maxPagesPerDomain: number;
  includeEnrichment?: boolean;
}

export function JobCostEstimate({
  targetCount,
  maxPagesPerDomain,
  includeEnrichment = true,
}: JobCostEstimateProps) {
  const { limits, tier } = usePlanLimits();

  const estimate = useMemo(() => {
    const scrapeCost = targetCount * CREDIT_COSTS.scrape;
    const enrichCost = includeEnrichment ? targetCount * CREDIT_COSTS.enrich : 0;
    const scoreCost = targetCount * CREDIT_COSTS.lead_score;
    const totalMin = scrapeCost;
    const totalMax = scrapeCost + enrichCost + scoreCost;

    const overTargetLimit = targetCount > limits.max_targets_per_job;
    const overPageLimit = maxPagesPerDomain > limits.max_pages_per_domain;

    return {
      scrapeCost,
      enrichCost,
      scoreCost,
      totalMin,
      totalMax,
      overTargetLimit,
      overPageLimit,
    };
  }, [targetCount, maxPagesPerDomain, includeEnrichment, limits]);

  if (targetCount === 0) return null;

  const hasWarnings = estimate.overTargetLimit || estimate.overPageLimit;

  return (
    <Card className={`border ${hasWarnings ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30"}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Cost Estimate</span>
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {tier} plan
          </Badge>
        </div>

        {/* Breakdown */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Scraping ({targetCount} targets × {CREDIT_COSTS.scrape} cr)</span>
            <span className="font-mono">{estimate.scrapeCost}</span>
          </div>
          {includeEnrichment && (
            <div className="flex justify-between text-muted-foreground">
              <span>Enrichment ({targetCount} × {CREDIT_COSTS.enrich} cr)</span>
              <span className="font-mono">{estimate.enrichCost}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Lead scoring ({targetCount} × {CREDIT_COSTS.lead_score} cr)</span>
            <span className="font-mono">{estimate.scoreCost}</span>
          </div>
          <div className="border-t border-border pt-1.5 flex justify-between font-medium text-foreground">
            <span>Estimated total</span>
            <span className="font-mono">
              {estimate.totalMin === estimate.totalMax
                ? `${estimate.totalMax} credits`
                : `${estimate.totalMin}–${estimate.totalMax} credits`}
            </span>
          </div>
        </div>

        {/* Plan limits info */}
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary">
            <Shield className="h-2.5 w-2.5" />
            Max {limits.max_targets_per_job} targets/job
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary">
            <Zap className="h-2.5 w-2.5" />
            Confidence stop @ {Math.round(limits.confidence_stop_threshold * 100)}%
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary">
            Max {limits.max_provider_calls_per_lead} providers/lead
          </span>
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div className="space-y-1">
            {estimate.overTargetLimit && (
              <div className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {targetCount} targets exceeds your plan limit of {limits.max_targets_per_job}. Job will be capped.
                </span>
              </div>
            )}
            {estimate.overPageLimit && (
              <div className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {maxPagesPerDomain} pages/domain exceeds your limit of {limits.max_pages_per_domain}. Will be reduced.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
