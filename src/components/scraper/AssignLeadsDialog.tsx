import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { scrapedLeadsApi } from '@/lib/api/scraper';
import { ClientOrganization } from '@/types/scraper';
import { toast } from 'sonner';
import { Users } from 'lucide-react';

interface AssignLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  organizations: ClientOrganization[];
  onSuccess?: () => void;
}

export function AssignLeadsDialog({
  open,
  onOpenChange,
  leadIds,
  organizations,
  onSuccess,
}: AssignLeadsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState<string>('');

  const assignMutation = useMutation({
    mutationFn: () => scrapedLeadsApi.assignToOrganization({
      lead_ids: leadIds,
      organization_id: selectedOrg,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      toast.success(`${leadIds.length} lead(s) assigned successfully`);
      onOpenChange(false);
      setSelectedOrg('');
      onSuccess?.();
    },
    onError: (error) => toast.error(`Failed to assign leads: ${error.message}`),
  });

  const activeOrgs = organizations.filter(org => org.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Leads
          </DialogTitle>
          <DialogDescription>
            Assign {leadIds.length} selected lead(s) to a client organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Client Organization</Label>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger>
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {activeOrgs.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No active organizations available
                  </div>
                ) : (
                  activeOrgs.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!selectedOrg || assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign Leads'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
