import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Smile, Meh, Frown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SentimentBadgeProps {
  logId: string;
  content: string | null;
  sentiment: string | null;
  onSentimentUpdate?: (newSentiment: string) => void;
}

export function SentimentBadge({ logId, content, sentiment, onSentimentUpdate }: SentimentBadgeProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentSentiment, setCurrentSentiment] = useState(sentiment);
  const [signals, setSignals] = useState<string | null>(null);

  const getSentimentConfig = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return {
          color: "bg-green-500/20 text-green-500 border-green-500/30",
          icon: <Smile className="w-3 h-3" />,
          label: "Positive"
        };
      case "negative":
        return {
          color: "bg-red-500/20 text-red-500 border-red-500/30",
          icon: <Frown className="w-3 h-3" />,
          label: "Negative"
        };
      default:
        return {
          color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
          icon: <Meh className="w-3 h-3" />,
          label: "Neutral"
        };
    }
  };

  const handleAnalyze = async () => {
    if (!content) {
      toast.error("No content to analyze");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-sentiment", {
        body: { logId, content },
      });

      if (error) throw error;

      if (data?.sentiment) {
        setCurrentSentiment(data.sentiment);
        setSignals(data.signals);
        onSentimentUpdate?.(data.sentiment);
        toast.success(`Sentiment: ${data.sentiment} (${data.confidence}% confidence)`);
      }
    } catch (err: any) {
      console.error("Sentiment error:", err);
      toast.error(err.message || "Failed to analyze sentiment");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!currentSentiment) {
    if (!content) return null;
    
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className="h-6 px-2 text-xs"
      >
        {isAnalyzing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Sparkles className="w-3 h-3" />
        )}
      </Button>
    );
  }

  const config = getSentimentConfig(currentSentiment);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`cursor-pointer text-xs ${config.color}`}
          onClick={handleAnalyze}
        >
          {isAnalyzing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            config.icon
          )}
          <span className="ml-1">{config.label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">Sentiment: {config.label}</p>
        {signals && <p className="text-xs text-muted-foreground mt-1">{signals}</p>}
        <p className="text-xs text-muted-foreground mt-1">Click to re-analyze</p>
      </TooltipContent>
    </Tooltip>
  );
}
