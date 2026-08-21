import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useGmail, scanGmailForFollowUps } from "@/hooks/useGmail";

const GmailCard = () => {
  const { status, loading, busy, connect, disconnect } = useGmail();
  const [scanning, setScanning] = useState(false);

  const onConnect = async () => {
    try {
      await connect();
      toast.success("Gmail connected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect Gmail");
    }
  };

  const onDisconnect = async () => {
    try {
      await disconnect();
      toast.success("Gmail disconnected");
    } catch {
      toast.error("Could not disconnect Gmail");
    }
  };

  const onScan = async () => {
    setScanning(true);
    try {
      const result = await scanGmailForFollowUps(7);
      if (!result.calendarConnected) {
        toast.error("Connect Google Calendar to create follow-up reminders.");
        return;
      }
      toast.success(
        `Scanned ${result.scanned ?? 0} conversations — ${result.created ?? 0} follow-up reminders created.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not scan Gmail");
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Gmail</CardTitle>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : status.connected ? (
            <Badge variant="secondary" className="text-[10px]">Connected</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Not connected</Badge>
          )}
        </div>
        <CardDescription>
          Connect your own inbox so Brivano can spot new or replied client emails and schedule
          follow-up reminders on your calendar. Only your account is accessed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.connected && status.accountEmail && (
          <p className="text-xs text-muted-foreground">
            Connected as <span className="font-medium text-foreground">{status.accountEmail}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {status.connected ? (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={onScan} disabled={scanning}>
                {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Scan recent email
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onConnect} disabled={busy}>
                Reconnect
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onDisconnect} disabled={busy}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" className="h-8 text-xs" onClick={onConnect} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Connect Gmail
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GmailCard;
