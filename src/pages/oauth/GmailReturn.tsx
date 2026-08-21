import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_mail";

export default function GmailReturn() {
  const [message, setMessage] = useState("Finishing your Gmail connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
    ) => {
      window.opener?.postMessage({ type, connectorId: CONNECTOR_ID }, window.location.origin);
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google sign-in did not complete.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }

    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        const reason =
          "This connection cannot be used yet: a workspace admin must enable offline access on the Gmail app user client.";
        setMessage(reason);
        window.opener?.postMessage(
          { type: "appUserConnectorOAuthFailed", connectorId: CONNECTOR_ID, reason },
          window.location.origin,
        );
        return;
      }
      setMessage("Google sign-in completed without an exchange code.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }

    void supabase.functions
      .invoke("gmail-oauth-complete", { body: { code } })
      .then(({ error }) => {
        if (error) throw error;
        notifyOpenerAndClose("appUserConnectorOAuthComplete");
      })
      .catch(() => {
        setMessage("Could not finish the Gmail connection.");
        notifyOpenerAndClose("appUserConnectorOAuthFailed");
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
