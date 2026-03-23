import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, MapPin, Building2, Users, DollarSign, Tag, Globe, Hash } from 'lucide-react';
import { useState } from 'react';
import { ProspectSearchFilters } from './constants';

interface FilterConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ProspectSearchFilters>;
  onConfirm: (filters: Partial<ProspectSearchFilters>) => void;
}

const FILTER_META: Record<string, { label: string; icon: React.ElementType }> = {
  industries: { label: 'Industries', icon: Building2 },
  companySizes: { label: 'Company Size', icon: Users },
  annualRevenue: { label: 'Annual Revenue', icon: DollarSign },
  countries: { label: 'Countries', icon: Globe },
  citiesOrStates: { label: 'Locations', icon: MapPin },
  keywordsInclude: { label: 'Keywords', icon: Tag },
  limit: { label: 'Result Limit', icon: Hash },
};

function formatValue(key: string, value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).replace(/_/g, ' '));
  return [String(value)];
}

export function FilterConfirmDialog({ open, onOpenChange, filters, onConfirm }: FilterConfirmDialogProps) {
  const entries = Object.entries(filters).filter(([_, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== '' && v !== null;
  });

  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(entries.map(([k]) => [k, true]))
  );

  const toggle = (key: string) => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleConfirm = () => {
    const confirmed: Partial<ProspectSearchFilters> = {};
    for (const [key, value] of entries) {
      if (enabled[key]) {
        (confirmed as any)[key] = value;
      }
    }
    onConfirm(confirmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Please review and confirm
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your description will apply the following filters:
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3 max-h-[50vh] overflow-y-auto">
          {entries.map(([key, value]) => {
            const meta = FILTER_META[key] || { label: key, icon: Tag };
            const Icon = meta.icon;
            const values = formatValue(key, value);

            return (
              <div key={key} className="flex items-start gap-2">
                <Checkbox
                  checked={enabled[key]}
                  onCheckedChange={() => toggle(key)}
                  className="mt-0.5"
                />
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{meta.label}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {values.map((v) => (
                      <Badge key={v} variant="secondary" className="text-[10px] capitalize">
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          Note: This will override your existing filters.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} className="bg-yellow-500 hover:bg-yellow-600 text-black">
            Yes, apply updates
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
