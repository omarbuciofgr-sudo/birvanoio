import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LeadScoreBadgeProps {
  leadId: string;
  score: number | null;
  onScoreUpdate?: (newScore: number) => void;
}

export function LeadScoreBadge({ leadId, score, onScoreUpdate }: LeadScoreBadgeProps) {
  const [isScoring, setIsScoring] = useState(false);
  const [currentScore, setCurrentScore] = useState(score);
  const [reasoning, setReasoning] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-green-500/20 text-green-500 border-green-500/30";
    if (score >= 40) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
    return "bg-red-500/20 text-red-500 border-red-500/30";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 70) return <TrendingUp className="w-3 h-3" />;
    if (score >= 40) return <Minus className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  const handleScore = async () => {
    setIsScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("score-lead", {
        body: { leadId },
      });

      if (error) throw error;

      if (data?.score !== undefined) {
        setCurrentScore(data.score);
        setReasoning(data.reasoning);
        onScoreUpdate?.(data.score);
        toast.success(`Lead scored: ${data.score}/100`);
      }
    } catch (err: any) {
      console.error("Score error:", err);
      toast.error(err.message || "Failed to score lead");
    } finally {
      setIsScoring(false);
    }
  };

  if (currentScore === null) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleScore}
        disabled={isScoring}
        className="h-7 px-2 text-xs"
      >
        {isScoring ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Scoring...
          </>
        ) : (
          <>
            <Sparkles className="w-3 h-3 mr-1" />
            AI Score
          </>
        )}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`cursor-pointer ${getScoreColor(currentScore)}`}
          onClick={handleScore}
        >
          {isScoring ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            getScoreIcon(currentScore)
          )}
          <span className="ml-1">{currentScore}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">AI Lead Score: {currentScore}/100</p>
        {reasoning && <p className="text-xs text-muted-foreground mt-1">{reasoning}</p>}
        <p className="text-xs text-muted-foreground mt-1">Click to refresh score</p>
      </TooltipContent>
    </Tooltip>
  );
}
