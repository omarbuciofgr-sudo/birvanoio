import { useState } from "react";
import { PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { logOutsideContact } from "@/lib/dailyGoals";

export function LogContactButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await logOutsideContact(leadId, note);
    setSaving(false);
    if (error) return toast.error(error);
    toast.success("Contact logged");
    setNote("");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><PhoneCall className="h-3.5 w-3.5" /> Log contact</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        <p className="text-sm font-medium">Log an outside call or message</p>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional note, e.g. Left voicemail" />
        <Button size="sm" className="w-full" onClick={save} disabled={saving}>{saving ? "Saving..." : "Log contact"}</Button>
      </PopoverContent>
    </Popover>
  );
}
