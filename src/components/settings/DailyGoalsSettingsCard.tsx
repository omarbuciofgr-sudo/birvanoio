import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { browserTimeZone, loadGoalSettings, notifyGoalsChanged } from "@/lib/dailyGoals";

export function DailyGoalsSettingsCard({ userId }: { userId: string }) {
  const [contact, setContact] = useState("10");
  const [followup, setFollowup] = useState("5");
  const [weekends, setWeekends] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGoalSettings(userId).then((s) => { setContact(String(s.contactGoal)); setFollowup(String(s.followupGoal)); setWeekends(s.weekendsCount); });
  }, [userId]);

  const save = async () => {
    const c = Number(contact), f = Number(followup);
    if (!Number.isInteger(c) || !Number.isInteger(f) || c < 1 || f < 1 || c > 500 || f > 500) return toast.error("Goals must be whole numbers from 1 to 500.");
    setSaving(true);
    const { error } = await (supabase as any).from("profiles").update({
      daily_contact_goal: c, daily_followup_goal: f, streak_counts_weekends: weekends, timezone: browserTimeZone(),
    }).eq("user_id", userId);
    setSaving(false);
    if (error) return toast.error("Couldn't save your goals. Please try again.");
    notifyGoalsChanged();
    toast.success("Daily goals saved");
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2"><Target className="h-4 w-4" /> Daily goals</CardTitle>
        <CardDescription>Shown on Home with your streak. Days follow your time zone ({browserTimeZone()}).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">Owners contacted per day</label>
            <Input type="number" min={1} max={500} value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Follow-ups completed per day</label>
            <Input type="number" min={1} max={500} value={followup} onChange={(e) => setFollowup(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">Weekends count toward my streak</p>
            <p className="text-xs text-muted-foreground">When off, missing Saturday or Sunday won't break your streak.</p>
          </div>
          <Switch checked={weekends} onCheckedChange={setWeekends} />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save goals"}</Button>
      </CardContent>
    </Card>
  );
}
