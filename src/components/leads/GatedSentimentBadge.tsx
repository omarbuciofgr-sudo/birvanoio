import { useSubscription } from "@/contexts/SubscriptionContext";
import { SentimentBadge } from "./SentimentBadge";
import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GatedSentimentBadgeProps {
  logId: string;
  content: string | null;
  sentiment: string | null;
  onSentimentUpdate?: (newSentiment: string) => void;
}

export function GatedSentimentBadge({ logId, content, sentiment, onSentimentUpdate }: GatedSentimentBadgeProps) {
  const { hasFeature, isLoading } = useSubscription();

  if (isLoading) {
    return null;
  }

  const hasAccess = hasFeature("sentiment_analysis");

  if (hasAccess) {
    return (
      <SentimentBadge 
        logId={logId} 
        content={content} 
        sentiment={sentiment} 
        onSentimentUpdate={onSentimentUpdate} 
      />
    );
  }

  // Show locked state for non-Growth/Scale users
  if (!content) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="cursor-not-allowed bg-muted/50 text-muted-foreground border-muted-foreground/30 text-xs"
        >
          <Lock className="w-3 h-3" />
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">AI Sentiment Analysis</p>
        <p className="text-xs text-muted-foreground mt-1">
          Upgrade to the Growth plan to unlock AI sentiment analysis.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
