import { useSubscription } from "@/contexts/SubscriptionContext";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GatedLeadScoreBadgeProps {
  leadId: string;
  score: number | null;
  onScoreUpdate?: (newScore: number) => void;
}

export function GatedLeadScoreBadge({ leadId, score, onScoreUpdate }: GatedLeadScoreBadgeProps) {
  const { hasFeature, isLoading } = useSubscription();

  if (isLoading) {
    return null;
  }

  const hasAccess = hasFeature("lead_scoring");

  if (hasAccess) {
    return <LeadScoreBadge leadId={leadId} score={score} onScoreUpdate={onScoreUpdate} />;
  }

  // Show locked state for non-Growth/Scale users
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="cursor-not-allowed bg-muted/50 text-muted-foreground border-muted-foreground/30"
        >
          <Lock className="w-3 h-3 mr-1" />
          <Sparkles className="w-3 h-3" />
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">AI Lead Scoring</p>
        <p className="text-xs text-muted-foreground mt-1">
          Upgrade to the Growth plan to unlock AI-powered lead scoring.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
