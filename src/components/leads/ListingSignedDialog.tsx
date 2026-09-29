import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  leadId: string | null;
  onClose: (saved: boolean) => void;
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ListingSignedDialog({ leadId, onClose }: Props) {
  const [price, setPrice] = useState("");
  const [rate, setRate] = useState("2.5");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    setPrice("");
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("default_commission_rate").eq("user_id", user.id).maybeSingle();
      if (data?.default_commission_rate != null) setRate(String(data.default_commission_rate));
    })();
  }, [leadId]);

  const p = Number(price.replace(/[$,\s]/g, ""));
  const r = Number(rate);
  const valid = p > 0 && p < 1e10 && r > 0 && r <= 100;

  const save = async () => {
    if (!leadId || !valid) return;
    setSaving(true);
    const { error } = await supabase.from("leads").update({ list_price: p, commission_rate: r } as any).eq("id", leadId);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ default_commission_rate: r } as any).eq("user_id", user.id);
    }
    setSaving(false);
    if (error) { toast.error("Couldn't save the listing details"); return; }
    toast.success(`Estimated commission: ${money((p * r) / 100)}`);
    onClose(true);
  };

  return (
    <Dialog open={!!leadId} onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Listing signed</DialogTitle>
          <DialogDescription>Add the list price and your commission rate to track what Brivano leads earn you.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ls-price">List price</Label>
            <Input id="ls-price" inputMode="decimal" placeholder="450,000" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ls-rate">Your commission rate (%)</Label>
            <Input id="ls-rate" type="number" step="0.1" min="0" max="100" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          {valid && <p className="text-sm text-muted-foreground">Estimated commission: <span className="font-semibold text-foreground">{money((p * r) / 100)}</span></p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>Skip</Button>
          <Button onClick={save} disabled={!valid || saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
