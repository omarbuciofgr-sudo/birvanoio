import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Pause, Play, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CityAutocomplete } from "@/components/onboarding/CityAutocomplete";

export type AlertListingType = "sale" | "rental" | "both";
export type AlertMatchLevel = "best" | "all";

type SavedAlert = {
  id: string;
  location: string;
  listing_type: AlertListingType;
  match_level: AlertMatchLevel;
  is_active: boolean;
  last_sent_at: string | null;
};

const db = supabase as any;
const TYPE_LABEL: Record<AlertListingType, string> = { sale: "Selling", rental: "Renting", both: "Selling and renting" };
const MATCH_LABEL: Record<AlertMatchLevel, string> = { best: "Best matches", all: "All results" };

function friendlyError(e: { message?: string } | null) {
  const m = e?.message ?? "";
  if (m.includes("SAVED_SEARCH_LIMIT")) return m.replace(/^.*SAVED_SEARCH_LIMIT:\s*/, "");
  return "Couldn't save that. Please try again.";
}

export function useSavedAlerts() {
  const [alerts, setAlerts] = useState<SavedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const { data } = await db.from("owner_search_alerts")
      .select("id, location, listing_type, match_level, is_active, last_sent_at")
      .order("created_at", { ascending: false });
    setAlerts(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { alerts, loading, refresh };
}

export async function createAlert(location: string, listingType: AlertListingType, matchLevel: AlertMatchLevel) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in first." };
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  const { error } = await db.from("owner_search_alerts").insert({
    user_id: auth.user.id, location: location.trim(), listing_type: listingType, match_level: matchLevel, timezone,
  });
  return { error: error ? friendlyError(error) : null };
}

interface Props {
  alerts: SavedAlert[];
  loading: boolean;
  refresh: () => void;
}

export function SavedSearchAlerts({ alerts, loading, refresh }: Props) {
  const [editing, setEditing] = useState<SavedAlert | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const update = async (id: string, patch: Partial<SavedAlert>) => {
    setBusyId(id);
    const { error } = await db.from("owner_search_alerts").update(patch).eq("id", id);
    setBusyId(null);
    if (error) {
      const msg = friendlyError(error);
      toast.error(msg, error.message?.includes("SAVED_SEARCH_LIMIT") ? { action: { label: "Upgrade", onClick: () => (window.location.href = "/dashboard/billing") } } : undefined);
      return false;
    }
    refresh();
    return true;
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this saved search and its daily alert?")) return;
    setBusyId(id);
    await db.from("owner_search_alerts").delete().eq("id", id);
    setBusyId(null);
    refresh();
  };

  if (loading) return <div className="h-16 animate-pulse rounded-lg bg-muted/40" />;

  return (
    <div className="rounded-lg border border-border/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Saved searches</h2>
        <span className="text-xs text-muted-foreground">Emailed at 7am your time when there are new owners · 1 credit per search each morning</span>
      </div>
      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No saved searches yet. Run a search, then click "Get daily alerts for this search".</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.location}</p>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABEL[a.listing_type]} · {MATCH_LABEL[a.match_level]}
                  {a.last_sent_at ? ` · last email ${new Date(a.last_sent_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">{a.is_active ? "Active" : "Paused"}</Badge>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={busyId === a.id}
                  onClick={() => update(a.id, { is_active: !a.is_active })}>
                  {a.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {a.is_active ? "Pause" : "Resume"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditing(a)}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" disabled={busyId === a.id} onClick={() => remove(a.id)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        Plan limits: Free 1, Starter 3, Growth 10, Scale 25 saved searches. <Link to="/dashboard/billing" className="underline">See plans</Link>
      </p>
      {editing && (
        <EditAlertDialog alert={editing} onClose={() => setEditing(null)}
          onSave={async (patch) => { if (await update(editing.id, patch)) setEditing(null); }} />
      )}
    </div>
  );
}

function EditAlertDialog({ alert, onClose, onSave }: {
  alert: SavedAlert; onClose: () => void; onSave: (p: Partial<SavedAlert>) => Promise<void>;
}) {
  const [location, setLocation] = useState(alert.location);
  const [type, setType] = useState<AlertListingType>(alert.listing_type);
  const [match, setMatch] = useState<AlertMatchLevel>(alert.match_level);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit saved search</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">City, State</label>
            <CityAutocomplete value={location} onChange={setLocation} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Looking for</label>
            <Select value={type} onValueChange={(v) => setType(v as AlertListingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Selling</SelectItem>
                <SelectItem value="rental">Renting</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Match level</label>
            <Select value={match} onValueChange={(v) => setMatch(v as AlertMatchLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Best matches</SelectItem>
                <SelectItem value="all">All results</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !location.trim()} onClick={async () => {
            setSaving(true);
            await onSave({ location: location.trim(), listing_type: type, match_level: match });
            setSaving(false);
          }}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
