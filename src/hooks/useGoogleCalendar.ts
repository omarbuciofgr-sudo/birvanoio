import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_calendar";

export type GoogleCalendarStatus = {
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
};

function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      ) {
        return;
      }
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve();
        return;
      }
      popup.close();
      reject(new Error(event.data?.reason ?? "Google Calendar connection failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Google window closed before the connection finished."));
    }, 500);
  });
}

export function useGoogleCalendar() {
  const [status, setStatus] = useState<GoogleCalendarStatus>({
    connected: false,
    accountEmail: null,
    connectedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-status", {
        body: { action: "status" },
      });
      if (error) throw error;
      setStatus({
        connected: !!data?.connected,
        accountEmail: data?.accountEmail ?? null,
        connectedAt: data?.connectedAt ?? null,
      });
    } catch {
      setStatus({ connected: false, accountEmail: null, connectedAt: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    const popup = window.open("", "brivano-google-calendar", "width=600,height=720");
    if (!popup) throw new Error("Popup blocked. Allow popups and try again.");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.authorizationUrl) throw new Error(data?.error ?? "Could not start Google sign-in.");
      const completion = waitForOAuthCompletion(popup);
      popup.location.href = data.authorizationUrl;
      await completion;
      await refresh();
    } catch (e) {
      popup.close();
      throw e;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("google-calendar-status", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { status, loading, busy, connect, disconnect, refresh };
}

/** Create/refresh the 6-month check-in and 1-year anniversary events for a closed deal. */
export async function scheduleDealFollowUps(dealId: string) {
  const { data, error } = await supabase.functions.invoke(
    "google-calendar-schedule-followups",
    { body: { dealId } },
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { connected: boolean; checkinDate?: string; anniversaryDate?: string };
}

/** Put a suggested follow-up on the calendar with reminders attached. */
export async function scheduleFollowUpTask(
  taskId: string,
  startAt?: string,
  durationMinutes = 30,
) {
  const { data, error } = await supabase.functions.invoke("google-calendar-schedule-task", {
    body: { taskId, startAt, durationMinutes },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { connected: boolean; eventId?: string; startAt?: string };
}
