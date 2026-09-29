import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addFollowUp, daysFromNow, localDate, markFollowUpDone, nextWeek, prettyDate } from "@/lib/followUps";

type FollowUp = { id: string; due_date: string; note: string | null };

/** "Set follow-up" box for an owner/lead: quick dates, optional note, open follow-ups list. */
export function SetFollowUp({ leadId }: { leadId: string }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [open, setOpen] = useState<FollowUp[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("lead_follow_ups")
      .select("id, due_date, note").eq("lead_id", leadId).is("done_at", null).order("due_date");
    setOpen(data ?? []);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const save = async (date: string) => {
    setSaving(true);
    const { error } = await addFollowUp(leadId, date, note);
    setSaving(false);
    if (error) return toast.error(error);
    toast.success(`Follow-up set for ${prettyDate(date)}`);
    setNote("");
    setPickOpen(false);
    load();
  };

  const done = async (id: string) => {
    const { error } = await markFollowUpDone(id);
    if (error) return toast.error(error);
    load();
  };

  const today = localDate();

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="outline" disabled={saving} onClick={() => save(daysFromNow(1))}>Tomorrow</Button>
        <Button size="sm" variant="outline" disabled={saving} onClick={() => save(daysFromNow(3))}>In 3 days</Button>
        <Button size="sm" variant="outline" disabled={saving} onClick={() => save(nextWeek())}>Next week</Button>
        <Popover open={pickOpen} onOpenChange={setPickOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" disabled={saving}>Pick a date</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              disabled={(d) => localDate(d) < today}
              onSelect={(d) => d && save(localDate(d))}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Optional note (e.g. ask about open house)"
        className="text-sm"
      />
      {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {open && open.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {open.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
              <div>
                <div className={`flex items-center gap-1 font-medium ${f.due_date < today ? "text-destructive" : ""}`}>
                  <CalendarClock className="h-3.5 w-3.5" />
                  {f.due_date < today ? "Overdue · " : f.due_date === today ? "Today · " : ""}{prettyDate(f.due_date)}
                </div>
                {f.note && <div className="text-muted-foreground mt-0.5">{f.note}</div>}
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => done(f.id)} aria-label="Mark done">
                <Check className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
