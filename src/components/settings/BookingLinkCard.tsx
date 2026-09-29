import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Copy, Unplug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { isValidBookingUrl, setBookingLinkCache } from "@/hooks/useBookingLink";

const webhookUrl = (token: string) =>
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/calcom-webhook?t=${token}`;

export function BookingLinkCard({ userId }: { userId: string }) {
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [conn, setConn] = useState<{ webhook_token: string; signing_secret: string; last_event_at: string | null } | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("booking_url").eq("user_id", userId).maybeSingle().then(({ data }) => setLink(data?.booking_url || ""));
    supabase.from("booking_integrations").select("webhook_token, signing_secret, last_event_at").eq("user_id", userId).maybeSingle().then(({ data }) => setConn(data));
  }, [userId]);

  const save = async () => {
    const v = link.trim();
    if (v && !isValidBookingUrl(v)) return toast.error("Enter a full link starting with https://");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ booking_url: v || null }).eq("user_id", userId);
    setSaving(false);
    if (error) return toast.error("Couldn't save your booking link");
    setBookingLinkCache(userId, v || null);
    toast.success(v ? "Booking link saved" : "Booking link removed");
  };

  const connect = async () => {
    setConnecting(true);
    const { data, error } = await supabase.functions.invoke("calcom-connect", { body: {} });
    setConnecting(false);
    if (error || !data?.webhook_token) return toast.error("Couldn't set up Cal.com. Please try again.");
    setConn({ ...data, last_event_at: null });
  };

  const disconnect = async () => {
    await supabase.from("booking_integrations").delete().eq("user_id", userId);
    setConn(null);
    toast.success("Cal.com disconnected");
  };

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };

  return (
    <div id="booking-link" className="rounded-lg border border-border p-4 space-y-4 scroll-mt-20">
      <div>
        <p className="text-sm font-medium text-foreground">Booking link</p>
        <p className="text-xs text-muted-foreground">Paste your Cal.com, Calendly or other scheduling link. Insert it into any text, email or script with one click.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://cal.com/your-name" maxLength={500} className="bg-secondary/50 border-border" />
        <Button onClick={save} disabled={saving} className="min-h-11 sm:min-h-9">{saving ? "Saving…" : "Save"}</Button>
      </div>

      <div className="rounded-md bg-muted/40 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarCheck className="h-4 w-4 text-primary" /> Connect Cal.com
            {conn && <Badge variant="secondary">{conn.last_event_at ? "Connected" : "Waiting for first booking"}</Badge>}
          </div>
          {conn ? (
            <Button size="sm" variant="ghost" className="min-h-11 gap-1 text-xs sm:min-h-8" onClick={disconnect}><Unplug className="h-3.5 w-3.5" /> Disconnect</Button>
          ) : (
            <Button size="sm" variant="outline" className="min-h-11 text-xs sm:min-h-8" onClick={connect} disabled={connecting}>{connecting ? "Setting up…" : "Connect Cal.com"}</Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          When an owner books with you on Cal.com, Brivano finds the lead by email or phone, moves it to "Appointment set", adds the time to the lead's timeline and puts it in Today's follow-ups on that day.
        </p>
        {conn && (
          <div className="space-y-2 text-xs">
            <p className="font-medium">In Cal.com, open Settings → Developer → Webhooks → New, then paste:</p>
            {[["Subscriber URL", webhookUrl(conn.webhook_token)], ["Secret", conn.signing_secret]].map(([label, v]) => (
              <div key={label} className="space-y-1">
                <p className="text-muted-foreground">{label}</p>
                <div className="flex gap-2">
                  <Input readOnly value={v} className="h-9 font-mono text-[11px]" onFocus={(e) => e.target.select()} />
                  <Button size="icon" variant="outline" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9" onClick={() => copy(v)} aria-label={`Copy ${label}`}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
            <p className="text-muted-foreground">Turn on the "Booking created" and "Booking rescheduled" events, then save.</p>
          </div>
        )}
      </div>
    </div>
  );
}
