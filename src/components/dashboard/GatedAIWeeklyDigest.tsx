import { useSubscription } from "@/contexts/SubscriptionContext";
import { AIWeeklyDigest } from "./AIWeeklyDigest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function GatedAIWeeklyDigest() {
  const { hasFeature, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) {
    return null;
  }

  const hasAccess = hasFeature("ai_weekly_digest");

  if (hasAccess) {
    return <AIWeeklyDigest />;
  }

  // Show locked state for non-Scale users
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                AI Weekly Digest
                <Badge variant="secondary" className="text-xs">Scale</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                AI-powered summary of your leads & trends
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Scale Plan Feature
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
            Get AI-powered weekly digests with insights on your best leads, 
            conversion trends, and recommended actions.
          </p>
          <Button
            onClick={() => {
              navigate("/");
              setTimeout(() => {
                document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to Scale
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
