import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Bot, Sparkles, Infinity } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GatedVoiceAgentProps {
  children: React.ReactNode;
}

export function GatedVoiceAgentPage({ children }: GatedVoiceAgentProps) {
  const { hasFeature, tier, isLoading, subscribed } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Check for any voice agent access (limited or unlimited)
  const hasLimitedAccess = hasFeature("ai_voice_agent_limited");
  const hasUnlimitedAccess = hasFeature("ai_voice_agent_unlimited");
  const hasAccess = hasLimitedAccess || hasUnlimitedAccess;

  if (hasAccess) {
    return (
      <>
        {/* Show usage indicator for limited plans */}
        {hasLimitedAccess && !hasUnlimitedAccess && (
          <div className="mb-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Bot className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">
                      AI Voice Agent • Limited minutes on Growth plan
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate("/");
                      setTimeout(() => {
                        document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }}
                    className="gap-2 text-xs"
                  >
                    <Infinity className="w-3 h-3" />
                    Upgrade for Unlimited
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {children}
      </>
    );
  }

  // Show locked state for Starter users
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            Voice AI Agent
          </h1>
          <p className="text-muted-foreground">
            Automated AI-powered outbound calls for lead qualification
          </p>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="py-16">
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <Badge variant="secondary" className="mb-4">Growth Plan Feature</Badge>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Unlock AI Voice Calling
            </h2>
            <p className="text-muted-foreground mb-6">
              Let AI handle your outbound calls. Our voice agent can qualify leads, 
              schedule appointments, and provide call summaries—all automatically.
            </p>
            <div className="space-y-3 text-left mb-6 p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Natural conversation with AI</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Automatic transcription & summaries</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Lead qualification scoring</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Powered by ElevenLabs</span>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => {
                navigate("/");
                setTimeout(() => {
                  document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Growth
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
