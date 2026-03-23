import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  CreditCard,
  Users,
  Minus,
  Plus,
  ExternalLink,
  AlertTriangle,
  Coins,
  Shield,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "secondary" },
  starter: { label: "Starter", color: "default" },
  growth: { label: "Growth", color: "default" },
  scale: { label: "Scale", color: "default" },
  enterprise: { label: "Enterprise", color: "default" },
};

const PLAN_PRICES: Record<string, number> = {
  starter: 49,
  growth: 99,
  scale: 249,
};

const CREDITS_PER_SEAT: Record<string, number> = {
  free: 50,
  starter: 500,
  growth: 2000,
  scale: 10000,
  enterprise: 999999,
};

interface MemberCredit {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  monthly_allowance: number;
  credits_used: number;
  topup_credits: number;
}

const Billing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    tier,
    billingStatus,
    subscribed,
    workspaceId,
    workspaceRole,
    seatsPurchased,
    seatsUsed,
    creditsAllowance,
    creditsUsed,
    subscriptionEnd,
    isWorkspaceOwnerOrAdmin,
    checkSubscription,
  } = useSubscription();

  const [members, setMembers] = useState<MemberCredit[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [seatInput, setSeatInput] = useState(seatsPurchased);
  const [updatingSeats, setUpdatingSeats] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Redirect non-owner/admin
  useEffect(() => {
    if (!isWorkspaceOwnerOrAdmin && workspaceRole !== null) {
      navigate("/dashboard");
    }
  }, [isWorkspaceOwnerOrAdmin, workspaceRole, navigate]);

  useEffect(() => {
    setSeatInput(seatsPurchased);
  }, [seatsPurchased]);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingMembers(true);

    try {
      // Get workspace members
      const { data: memberships } = await supabase
        .from("workspace_memberships")
        .select("user_id, role")
        .eq("workspace_id", workspaceId);

      if (!memberships?.length) {
        setMembers([]);
        return;
      }

      const userIds = memberships.map((m) => m.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name")
        .in("user_id", userIds);

      // Get credit data for current period
      const today = new Date().toISOString().slice(0, 10);
      const { data: credits } = await supabase
        .from("user_monthly_credits")
        .select("user_id, monthly_allowance, credits_used, topup_credits")
        .eq("workspace_id", workspaceId)
        .lte("period_start", today)
        .gte("period_end", today);

      const profileMap = Object.fromEntries(
        (profiles || []).map((p) => [p.user_id, p])
      );
      const creditMap = Object.fromEntries(
        (credits || []).map((c) => [c.user_id, c])
      );

      const combined: MemberCredit[] = memberships.map((m) => {
        const profile = profileMap[m.user_id];
        const credit = creditMap[m.user_id];
        return {
          user_id: m.user_id,
          email: profile?.email || "Unknown",
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          role: m.role,
          monthly_allowance: credit?.monthly_allowance || 0,
          credits_used: credit?.credits_used || 0,
          topup_credits: credit?.topup_credits || 0,
        };
      });

      setMembers(combined);
    } catch {
      toast.error("Failed to load member data");
    } finally {
      setLoadingMembers(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleUpdateSeats = async () => {
    if (seatInput === seatsPurchased || seatInput < 1) return;
    setUpdatingSeats(true);

    try {
      const { data, error } = await supabase.functions.invoke("update-seats", {
        body: { seats: seatInput },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Seats updated to ${seatInput}. Proration applied.`);
      await checkSubscription();
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update seats");
      setSeatInput(seatsPurchased);
    } finally {
      setUpdatingSeats(false);
    }
  };

  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setOpeningPortal(false);
    }
  };

  const effectiveTier = tier || "free";
  const pricePerSeat = PLAN_PRICES[effectiveTier] || 0;
  const creditsPerSeat = CREDITS_PER_SEAT[effectiveTier] || 0;
  const totalMonthly = pricePerSeat * seatsPurchased;
  const planInfo = PLAN_LABELS[effectiveTier] || PLAN_LABELS.free;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing & Seats</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your subscription, seats, and credit allocations.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { checkSubscription(); fetchMembers(); }}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            {subscribed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPortal}
                disabled={openingPortal}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                {openingPortal ? "Opening…" : "Manage in Stripe"}
              </Button>
            )}
          </div>
        </div>

        {/* Billing status warning */}
        {billingStatus === "past_due" && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-destructive">Payment past due</p>
              <p className="text-sm text-muted-foreground">
                Your last payment failed. New jobs and enrichment are blocked until resolved.
                <Button variant="link" size="sm" className="px-1 h-auto" onClick={handleOpenPortal}>
                  Update payment method →
                </Button>
              </p>
            </div>
          </div>
        )}

        {billingStatus === "canceled" && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border">
            <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium text-foreground">Subscription canceled</p>
              <p className="text-sm text-muted-foreground">
                Your workspace is in read-only mode. Re-subscribe to restore full access.
              </p>
            </div>
          </div>
        )}

        {/* Plan + Seats overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Plan */}
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Current Plan
              </CardDescription>
              <CardTitle className="text-xl flex items-center gap-2">
                {planInfo.label}
                <Badge variant={billingStatus === "active" ? "default" : "destructive"} className="text-xs">
                  {billingStatus || "free"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price per seat</span>
                <span className="font-medium text-foreground">
                  {pricePerSeat > 0 ? `$${pricePerSeat}/mo` : "Free"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monthly total</span>
                <span className="font-semibold text-foreground">
                  {totalMonthly > 0 ? `$${totalMonthly}/mo` : "Free"}
                </span>
              </div>
              {subscriptionEnd && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Renews</span>
                  <span className="text-foreground">
                    {new Date(subscriptionEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seats */}
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Seats
              </CardDescription>
              <CardTitle className="text-xl">
                {seatsUsed} / {seatsPurchased} used
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={seatsPurchased > 0 ? (seatsUsed / seatsPurchased) * 100 : 0}
                className="h-2"
              />
              {subscribed && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={seatInput <= seatsUsed || updatingSeats}
                    onClick={() => setSeatInput((s) => Math.max(seatsUsed, s - 1))}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-sm font-medium w-8 text-center text-foreground">{seatInput}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={seatInput >= 100 || updatingSeats}
                    onClick={() => setSeatInput((s) => Math.min(100, s + 1))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  {seatInput !== seatsPurchased && (
                    <Button
                      size="sm"
                      onClick={handleUpdateSeats}
                      disabled={updatingSeats}
                      className="ml-2"
                    >
                      {updatingSeats ? "Updating…" : "Apply"}
                    </Button>
                  )}
                </div>
              )}
              {seatInput !== seatsPurchased && pricePerSeat > 0 && (
                <p className="text-xs text-muted-foreground">
                  New total: ${pricePerSeat * seatInput}/mo (prorated immediately)
                </p>
              )}
            </CardContent>
          </Card>

          {/* Credits */}
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" />
                Credits This Period
              </CardDescription>
              <CardTitle className="text-xl">
                {(creditsAllowance - creditsUsed).toLocaleString()} remaining
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress
                value={creditsAllowance > 0 ? (creditsUsed / creditsAllowance) * 100 : 0}
                className="h-2"
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Per seat</span>
                <span className="text-foreground">{creditsPerSeat.toLocaleString()} credits/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used / Total</span>
                <span className="text-foreground">
                  {creditsUsed.toLocaleString()} / {creditsAllowance.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Member credit table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Member Credit Balances
                </CardTitle>
                <CardDescription>Credit allocation and usage for each workspace member.</CardDescription>
              </div>
              {/* Add-on credits placeholder */}
              <Button variant="outline" size="sm" disabled>
                <Coins className="h-4 w-4 mr-1" />
                Buy Add-on Credits
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingMembers ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading members…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No members found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Allowance</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Add-ons</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="w-[120px]">Usage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const total = m.monthly_allowance + m.topup_credits;
                    const remaining = Math.max(0, total - m.credits_used);
                    const pct = total > 0 ? (m.credits_used / total) * 100 : 0;
                    const displayName = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
                    const isCurrentUser = m.user_id === user?.id;

                    return (
                      <TableRow key={m.user_id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground text-sm">
                              {displayName}
                              {isCurrentUser && (
                                <span className="text-xs text-muted-foreground ml-1">(you)</span>
                              )}
                            </span>
                            {displayName !== m.email && (
                              <span className="text-xs text-muted-foreground">{m.email}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {m.role === "owner" && <Shield className="h-3 w-3 mr-1" />}
                            {m.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {m.monthly_allowance.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {m.credits_used.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {m.topup_credits > 0 ? `+${m.topup_credits.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground">
                          {remaining.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Progress value={pct} className="h-1.5" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Billing;
