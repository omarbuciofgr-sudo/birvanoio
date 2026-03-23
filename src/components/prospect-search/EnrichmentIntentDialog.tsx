import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles } from 'lucide-react';

export interface EnrichmentIntent {
  goals: string[];
  customGoal: string;
}

interface EnrichmentIntentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionLabel: string;
  onConfirm: (intent: EnrichmentIntent) => void;
}

const GOAL_OPTIONS = [
  { id: 'email', label: 'Find work email' },
  { id: 'phone', label: 'Find phone number' },
  { id: 'person', label: 'Find decision-maker / owner' },
  { id: 'company_info', label: 'Company overview & summary' },
  { id: 'revenue', label: 'Revenue / funding data' },
  { id: 'techstack', label: 'Technology stack' },
  { id: 'social', label: 'LinkedIn / social profiles' },
];

export function EnrichmentIntentDialog({ open, onOpenChange, actionLabel, onConfirm }: EnrichmentIntentDialogProps) {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState('');

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const handleConfirm = () => {
    onConfirm({ goals: selectedGoals, customGoal: customGoal.trim() });
    setSelectedGoals([]);
    setCustomGoal('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What are you looking for?
          </DialogTitle>
          <DialogDescription>
            Tell us what you want to find so we can use the best enrichment sources for <strong>{actionLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {GOAL_OPTIONS.map(opt => (
            <div key={opt.id} className="flex items-center gap-2.5">
              <Checkbox
                id={opt.id}
                checked={selectedGoals.includes(opt.id)}
                onCheckedChange={() => toggleGoal(opt.id)}
              />
              <Label htmlFor={opt.id} className="text-sm cursor-pointer">{opt.label}</Label>
            </div>
          ))}
          <Textarea
            placeholder="Anything else specific? e.g. 'Find the marketing director's email'"
            value={customGoal}
            onChange={e => setCustomGoal(e.target.value)}
            className="text-sm mt-2"
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={selectedGoals.length === 0 && !customGoal.trim()}>
            Run Enrichment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}