import { useSubscription } from "@/contexts/SubscriptionContext";
import { WebhookIntegrations } from "./WebhookIntegrations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Zap, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GatedWebhookIntegrationsProps {
  userId: string;
}

export function GatedWebhookIntegrations({ userId }: GatedWebhookIntegrationsProps) {
  const { hasFeature, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) {
    return null;
  }

  const hasAccess = hasFeature("webhook_integrations");

  if (hasAccess) {
    return <WebhookIntegrations userId={userId} />;
  }

  // Show locked state for non-Scale users
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Webhook Integrations
              <Badge variant="secondary" className="text-xs ml-2">Scale</Badge>
            </CardTitle>
            <CardDescription>
              Connect with Zapier, Make, or other automation tools
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Scale Plan Feature
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
            Integrate with Zapier, Make, and other automation platforms to connect
            your CRM to hundreds of other tools.
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
