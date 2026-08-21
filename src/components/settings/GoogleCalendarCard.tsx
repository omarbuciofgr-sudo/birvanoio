import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

const GoogleCalendarCard = () => {
  const { status, loading, busy, connect, disconnect } = useGoogleCalendar();

  const onConnect = async () => {
    try {
      await connect();
      toast.success("Google Calendar connected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect Google Calendar");
    }
  };

  const onDisconnect = async () => {
    try {
      await disconnect();
      toast.success("Google Calendar disconnected");
    } catch {
      toast.error("Could not disconnect Google Calendar");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Google Calendar</CardTitle>
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
          Connect your own Google account so Brivano can add closed-client check-ins and 1-year
          anniversary reminders straight to your calendar.
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
              Connect Google Calendar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarCard;
