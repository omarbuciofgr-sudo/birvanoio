import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { enrichmentRulesApi, EnrichmentRule } from '@/lib/api/scraperFeatures';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Zap, Mail, Phone, Building, Linkedin, Loader2 } from 'lucide-react';

export function EnrichmentRulesManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EnrichmentRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    trigger_on: 'score_above',
    min_score: 70,
    enrich_email: true,
    enrich_phone: true,
    enrich_company: true,
    enrich_linkedin: true,
    max_credits_per_lead: 0.5,
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['enrichment-rules'],
    queryFn: () => enrichmentRulesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<EnrichmentRule>) => enrichmentRulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-rules'] });
      toast.success('Enrichment rule created');
      resetForm();
    },
    onError: (error) => toast.error(`Failed to create rule: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EnrichmentRule> }) =>
      enrichmentRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-rules'] });
      toast.success('Enrichment rule updated');
      resetForm();
    },
    onError: (error) => toast.error(`Failed to update rule: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => enrichmentRulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-rules'] });
      toast.success('Enrichment rule deleted');
    },
    onError: (error) => toast.error(`Failed to delete rule: ${error.message}`),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      trigger_on: 'score_above',
      min_score: 70,
      enrich_email: true,
      enrich_phone: true,
      enrich_company: true,
      enrich_linkedin: true,
      max_credits_per_lead: 0.5,
    });
    setEditingRule(null);
    setDialogOpen(false);
  };

  const handleEdit = (rule: EnrichmentRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      trigger_on: rule.trigger_on,
      min_score: rule.min_score,
      enrich_email: rule.enrich_email,
      enrich_phone: rule.enrich_phone,
      enrich_company: rule.enrich_company,
      enrich_linkedin: rule.enrich_linkedin,
      max_credits_per_lead: rule.max_credits_per_lead,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleActive = (rule: EnrichmentRule) => {
    updateMutation.mutate({ id: rule.id, data: { is_active: !rule.is_active } });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Auto-Enrichment Rules</h3>
          <p className="text-sm text-muted-foreground">
            Automatically enrich leads based on score thresholds
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit' : 'Create'} Enrichment Rule</DialogTitle>
              <DialogDescription>
                Configure when leads should be automatically enriched
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., High-Value Lead Enrichment"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="space-y-2">
                <Label>Trigger When</Label>
                <Select
                  value={formData.trigger_on}
                  onValueChange={(value) => setFormData({ ...formData, trigger_on: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score_above">Score Above Threshold</SelectItem>
                    <SelectItem value="new_lead">New Lead Created</SelectItem>
                    <SelectItem value="manual">Manual Trigger Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.trigger_on === 'score_above' && (
                <div className="space-y-2">
                  <Label>Minimum Score: {formData.min_score}</Label>
                  <Slider
                    value={[formData.min_score]}
                    onValueChange={([value]) => setFormData({ ...formData, min_score: value })}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              )}

              <div className="space-y-3">
                <Label>Enrichment Options</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.enrich_email}
                      onCheckedChange={(checked) => setFormData({ ...formData, enrich_email: checked })}
                    />
                    <Label className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.enrich_phone}
                      onCheckedChange={(checked) => setFormData({ ...formData, enrich_phone: checked })}
                    />
                    <Label className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.enrich_company}
                      onCheckedChange={(checked) => setFormData({ ...formData, enrich_company: checked })}
                    />
                    <Label className="flex items-center gap-1">
                      <Building className="h-3 w-3" /> Company
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.enrich_linkedin}
                      onCheckedChange={(checked) => setFormData({ ...formData, enrich_linkedin: checked })}
                    />
                    <Label className="flex items-center gap-1">
                      <Linkedin className="h-3 w-3" /> LinkedIn
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max Credits per Lead: ${formData.max_credits_per_lead.toFixed(2)}</Label>
                <Slider
                  value={[formData.max_credits_per_lead * 100]}
                  onValueChange={([value]) => setFormData({ ...formData, max_credits_per_lead: value / 100 })}
                  min={10}
                  max={200}
                  step={10}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingRule ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rules && rules.length > 0 ? (
        <div className="grid gap-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">
                        {rule.trigger_on === 'score_above' 
                          ? `Score ≥ ${rule.min_score}` 
                          : rule.trigger_on === 'new_lead' 
                            ? 'On New Lead' 
                            : 'Manual'}
                      </Badge>
                      {rule.enrich_email && <Badge variant="secondary"><Mail className="h-3 w-3 mr-1" />Email</Badge>}
                      {rule.enrich_phone && <Badge variant="secondary"><Phone className="h-3 w-3 mr-1" />Phone</Badge>}
                      {rule.enrich_company && <Badge variant="secondary"><Building className="h-3 w-3 mr-1" />Company</Badge>}
                      {rule.enrich_linkedin && <Badge variant="secondary"><Linkedin className="h-3 w-3 mr-1" />LinkedIn</Badge>}
                      <Badge variant="outline">${rule.max_credits_per_lead}/lead</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => toggleActive(rule)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteMutation.mutate(rule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No enrichment rules configured</p>
            <p className="text-sm">Create a rule to automatically enrich high-value leads</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
