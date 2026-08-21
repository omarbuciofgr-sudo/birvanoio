import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Ban, Loader2, Trash2 } from "lucide-react";
import { useContactGuard, type SuppressionEntry } from "@/hooks/useContactGuard";

/** Workspace-wide do-not-contact list shared by every teammate. */
export function ContactGuardCard() {
  const { workspaceId, loading, listSuppression, addSuppression, removeSuppression } = useContactGuard();
  const [entries, setEntries] = useState<SuppressionEntry[]>([]);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setEntries(await listSuppression());
  }, [listSuppression]);

  useEffect(() => {
    if (workspaceId) refresh();
  }, [workspaceId, refresh]);

  const add = async () => {
    setBusy(true);
    try {
      await addSuppression(value, reason);
      setValue("");
      setReason("");
      await refresh();
      toast.success("Added to do-not-contact");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add entry");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await removeSuppression(id);
      await refresh();
      toast.success("Removed");
    } catch {
      toast.error("Only workspace owners and admins can remove entries");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ban className="h-4 w-4 text-destructive" /> Do-not-contact list
        </CardTitle>
        <CardDescription className="text-xs">
          Numbers and emails on this list are blocked across the workspace. Call, text and email actions also
          warn you when a teammate already reached the same person.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Phone or email</Label>
            <Input
              className="h-9"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="312-555-0134 or owner@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason</Label>
            <Input
              className="h-9"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Asked not to be called"
            />
          </div>
          <Button size="sm" className="h-9" disabled={!value.trim() || busy} onClick={add}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </Button>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No suppressed contacts yet.</p>
        ) : (
          <div className="max-h-64 overflow-auto rounded-md border border-border divide-y divide-border/60">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.value_normalized}</p>
                  {e.reason && <p className="text-muted-foreground truncate">{e.reason}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] h-4 uppercase">
                    {e.value_type}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(e.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ContactGuardCard;
