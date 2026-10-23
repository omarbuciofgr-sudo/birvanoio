import { useState } from "react";
import { PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { logCallOutcome } from "@/lib/dailyGoals";
import { daysFromNow } from "@/lib/followUps";
import { OUTCOMES, type CallOutcome } from "@/lib/playbook";
import { cn } from "@/lib/utils";

/** Log a call outcome with an optional follow-up date. */
export function LogContactButton({ leadId, onLogged, label = "Log call" }: { leadId: string; onLogged?: (o: CallOutcome) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const pick = (o: (typeof OUTCOMES)[number]) => {
    setOutcome(o.key);
    setDate(o.followUpDays == null ? "" : daysFromNow(o.followUpDays));
  };

  const save = async () => {
    if (!outcome) return;
    setSaving(true);
    const { error } = await logCallOutcome(leadId, outcome, { note, followUpDate: date || null });
    setSaving(false);
    if (error) return toast.error(error);
    toast.success(outcome === "do_not_call" ? "Marked do not contact" : date ? "Call logged and follow-up set" : "Call logged");
    onLogged?.(outcome);
    setOutcome(null); setNote(""); setDate(""); setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11 gap-1.5 text-xs md:min-h-8"><PhoneCall className="h-3.5 w-3.5" /> {label}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <p className="text-sm font-medium">How did the call go?</p>
        <div className="grid grid-cols-2 gap-2">
          {OUTCOMES.map((o) => (
            <button key={o.key} type="button" onClick={() => pick(o)}
              className={cn("min-h-11 rounded-md border px-2 text-xs", outcome === o.key ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted",
                o.key === "do_not_call" && outcome !== o.key && "text-destructive")}>
              {o.label}
            </button>
          ))}
        </div>
        {outcome && outcome !== "do_not_call" && (
          <label className="block space-y-1 text-xs text-muted-foreground">
            Follow-up date (optional)
            <Input type="date" className="h-11" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
        {outcome === "do_not_call" && <p className="text-xs text-muted-foreground">Call and text buttons will be hidden for this owner and any follow-up plan stops.</p>}
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional note" className="h-11" />
        <Button size="sm" className="min-h-11 w-full" onClick={save} disabled={!outcome || saving}>{saving ? "Saving..." : "Save"}</Button>
      </PopoverContent>
    </Popover>
  );
}
