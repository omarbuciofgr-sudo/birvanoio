import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  is_active: boolean;
}

interface AddToCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  onSuccess?: () => void;
}

export function AddToCampaignDialog({
  open,
  onOpenChange,
  leadIds,
  onSuccess,
}: AddToCampaignDialogProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedCampaign("");
    setLoading(true);
    supabase
      .from("email_campaigns")
      .select("id, name, is_active")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setCampaigns(data);
        setLoading(false);
      });
  }, [open]);

  const enroll = async () => {
    if (!selectedCampaign || leadIds.length === 0) return;
    setSaving(true);

    // Skip leads already enrolled to avoid unique-constraint errors
    const { data: existing } = await supabase
      .from("lead_campaign_enrollments")
      .select("lead_id")
      .eq("campaign_id", selectedCampaign)
      .in("lead_id", leadIds);

    const enrolledIds = new Set((existing || []).map((e: any) => e.lead_id));
    const toInsert = leadIds
      .filter((id) => !enrolledIds.has(id))
      .map((lead_id) => ({
        lead_id,
        campaign_id: selectedCampaign,
        current_step: 1,
        status: "active",
        next_send_at: new Date().toISOString(),
      }));

    if (toInsert.length === 0) {
      toast.info("All selected leads are already in this campaign");
      setSaving(false);
      onOpenChange(false);
      return;
    }

    const { error } = await supabase
      .from("lead_campaign_enrollments")
      .insert(toInsert);

    if (error) {
      toast.error(`Failed to add to campaign: ${error.message}`);
    } else {
      const skipped = leadIds.length - toInsert.length;
      toast.success(
        `Added ${toInsert.length} lead${toInsert.length === 1 ? "" : "s"} to campaign${
          skipped > 0 ? ` (${skipped} already enrolled)` : ""
        }`
      );
      onOpenChange(false);
      onSuccess?.();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Add to Campaign
          </DialogTitle>
          <DialogDescription>
            Enroll {leadIds.length} lead{leadIds.length === 1 ? "" : "s"} into an
            email drip campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No campaigns yet. Create one from the Campaigns page first.
            </p>
          ) : (
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.is_active ? "" : "(paused)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={enroll} disabled={!selectedCampaign || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add to Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
