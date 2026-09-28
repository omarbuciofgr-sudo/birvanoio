import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function useCommunicationCompliance() {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("communication_compliance_accepted_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setAccepted(Boolean(data?.communication_compliance_accepted_at)));
  }, [user]);

  const requireAcceptance = useCallback((action: () => void) => {
    if (accepted) {
      action();
      return;
    }
    setPendingAction(() => action);
    setOpen(true);
  }, [accepted]);

  const accept = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const acceptedAt = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ communication_compliance_accepted_at: acceptedAt })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save your acceptance. Please try again.");
      return;
    }
    setAccepted(true);
    setOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction, user]);

  const complianceDialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Responsible outreach</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">Before texting or calling, you must confirm that your outreach follows TCPA and applicable Do Not Call rules.</span>
            <span className="block">You are responsible for having any required consent and for honoring every opt-out request.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(event) => { event.preventDefault(); void accept(); }} disabled={saving}>
            {saving ? "Saving…" : "I understand and accept"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { accepted, requireAcceptance, complianceDialog };
}