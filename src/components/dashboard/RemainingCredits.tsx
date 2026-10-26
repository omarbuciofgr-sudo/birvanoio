import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/contexts/SubscriptionContext";

export function RemainingCredits() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { creditsRemaining, isLoading, error, checkSubscription } = useSubscription();
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (document.visibilityState === "visible") void checkSubscription(); };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [user?.id, pathname, checkSubscription]);
  if (!user) return null;
  return <Button asChild variant="outline" className="h-11 shrink-0 gap-1.5 px-2 text-xs sm:px-3" aria-label={error ? "Check credits in Billing" : `${creditsRemaining.toLocaleString()} credits left. Open Billing`}>
    <Link to="/dashboard/billing"><Coins className="h-4 w-4 text-primary" />
      {isLoading ? <Skeleton className="h-4 w-16" /> : error ? <span>Check credits</span> : <span><strong className="tabular-nums">{creditsRemaining.toLocaleString()}</strong> credits left</span>}
    </Link>
  </Button>;
}