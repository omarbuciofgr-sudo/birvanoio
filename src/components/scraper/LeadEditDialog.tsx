import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import type { ScrapedLead, ScrapedLeadStatus } from '@/types/scraper';

interface LeadEditDialogProps {
  lead: ScrapedLead | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: ScrapedLeadStatus[] = ['new', 'review', 'approved', 'assigned', 'in_progress', 'won', 'lost', 'rejected'];

export function LeadEditDialog({ lead, open, onClose }: LeadEditDialogProps) {
  const queryClient = useQueryClient();
  const [editReason, setEditReason] = useState('');
  const [formData, setFormData] = useState<Partial<ScrapedLead>>({});

  // Initialize form data when lead changes
  useState(() => {
    if (lead) {
      setFormData({
        full_name: lead.full_name,
        best_email: lead.best_email,
        best_phone: lead.best_phone,
        address: lead.address,
        status: lead.status,
        lead_type: lead.lead_type,
        best_contact_title: lead.best_contact_title,
        qc_notes: lead.qc_notes,
        rejection_reason: lead.rejection_reason,
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { lead: Partial<ScrapedLead>; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Get original values for audit log
      const originalLead = lead!;
      const changedFields: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      Object.entries(updates.lead).forEach(([key, value]) => {
        const oldValue = originalLead[key as keyof ScrapedLead];
        if (String(oldValue) !== String(value)) {
          changedFields.push({
            field: key,
            oldValue: oldValue != null ? String(oldValue) : null,
            newValue: value != null ? String(value) : null,
          });
        }
      });

      // Update the lead
      const updateData: Record<string, unknown> = {
        ...updates.lead,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('scraped_leads')
        .update(updateData)
        .eq('id', originalLead.id);

      if (updateError) throw updateError;

      // Create audit log entries
      for (const change of changedFields) {
        await supabase.from('audit_log').insert({
          table_name: 'scraped_leads',
          record_id: originalLead.id,
          action: change.field === 'status' ? 'status_change' : 'update',
          field_name: change.field,
          old_value: change.oldValue,
          new_value: change.newValue,
          reason: updates.reason,
          performed_by: userId,
        });
      }
    },
    onSuccess: () => {
      toast.success('Lead updated successfully');
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to update lead: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!lead) return;
    updateMutation.mutate({ lead: formData, reason: editReason });
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Lead: {lead.domain}</DialogTitle>
          <DialogDescription>
            Make changes to this lead. All changes are logged for audit purposes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Status & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status || lead.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as ScrapedLeadStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead_type">Lead Type</Label>
                <Select
                  value={formData.lead_type || lead.lead_type}
                  onValueChange={(value) => setFormData({ ...formData, lead_type: value as 'person' | 'company' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-4">
              <h4 className="font-medium">Contact Information</h4>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name ?? lead.full_name ?? ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Contact name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="best_contact_title">Title</Label>
                <Input
                  id="best_contact_title"
                  value={formData.best_contact_title ?? lead.best_contact_title ?? ''}
                  onChange={(e) => setFormData({ ...formData, best_contact_title: e.target.value })}
                  placeholder="Job title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="best_email">Email</Label>
                <Input
                  id="best_email"
                  type="email"
                  value={formData.best_email ?? lead.best_email ?? ''}
                  onChange={(e) => setFormData({ ...formData, best_email: e.target.value })}
                  placeholder="Email address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="best_phone">Phone</Label>
                <Input
                  id="best_phone"
                  value={formData.best_phone ?? lead.best_phone ?? ''}
                  onChange={(e) => setFormData({ ...formData, best_phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address ?? lead.address ?? ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Business address"
                />
              </div>
            </div>

            <Separator />

            {/* QC Notes */}
            <div className="space-y-2">
              <Label htmlFor="qc_notes">QC Notes</Label>
              <Textarea
                id="qc_notes"
                value={formData.qc_notes ?? lead.qc_notes ?? ''}
                onChange={(e) => setFormData({ ...formData, qc_notes: e.target.value })}
                placeholder="Quality control notes..."
                rows={2}
              />
            </div>

            {/* Rejection Reason (if status is rejected) */}
            {(formData.status === 'rejected' || lead.status === 'rejected') && (
              <div className="space-y-2">
                <Label htmlFor="rejection_reason">Rejection Reason</Label>
                <Textarea
                  id="rejection_reason"
                  value={formData.rejection_reason ?? lead.rejection_reason ?? ''}
                  onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                  placeholder="Why was this lead rejected?"
                  rows={2}
                />
              </div>
            )}

            <Separator />

            {/* Edit Reason */}
            <div className="space-y-2">
              <Label htmlFor="edit_reason">Reason for Edit *</Label>
              <Textarea
                id="edit_reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Describe why you're making these changes..."
                rows={2}
                required
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending || !editReason.trim()}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
