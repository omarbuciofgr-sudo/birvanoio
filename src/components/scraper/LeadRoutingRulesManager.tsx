import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadRoutingRulesApi, LeadRoutingRule } from '@/lib/api/scraperFeatures';
import { clientOrganizationsApi } from '@/lib/api/scraper';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Route, Building, Webhook, Zap, Loader2, ArrowRight } from 'lucide-react';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Real Estate', 'Retail',
  'Manufacturing', 'Education', 'Legal', 'Insurance', 'Construction'
];

const LEAD_TYPES = ['b2b', 'fsbo', 'frbo', 'real_estate', 'general'];

export function LeadRoutingRulesManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<LeadRoutingRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    priority: 0,
    criteria_industry: [] as string[],
    criteria_state: [] as string[],
    criteria_min_score: null as number | null,
    criteria_max_score: null as number | null,
    criteria_lead_type: [] as string[],
    assign_to_org: null as string | null,
    auto_enrich: false,
    send_webhook: false,
    webhook_url: '',
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['lead-routing-rules'],
    queryFn: () => leadRoutingRulesApi.list(),
  });

  const { data: organizations } = useQuery({
    queryKey: ['client-organizations'],
    queryFn: () => clientOrganizationsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<LeadRoutingRule>) => leadRoutingRulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-routing-rules'] });
      toast.success('Routing rule created');
      resetForm();
    },
    onError: (error) => toast.error(`Failed to create rule: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LeadRoutingRule> }) =>
      leadRoutingRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-routing-rules'] });
      toast.success('Routing rule updated');
      resetForm();
    },
    onError: (error) => toast.error(`Failed to update rule: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadRoutingRulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-routing-rules'] });
      toast.success('Routing rule deleted');
    },
    onError: (error) => toast.error(`Failed to delete rule: ${error.message}`),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      priority: 0,
      criteria_industry: [],
      criteria_state: [],
      criteria_min_score: null,
      criteria_max_score: null,
      criteria_lead_type: [],
      assign_to_org: null,
      auto_enrich: false,
      send_webhook: false,
      webhook_url: '',
    });
    setEditingRule(null);
    setDialogOpen(false);
  };

  const handleEdit = (rule: LeadRoutingRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      priority: rule.priority,
      criteria_industry: rule.criteria_industry || [],
      criteria_state: rule.criteria_state || [],
      criteria_min_score: rule.criteria_min_score,
      criteria_max_score: rule.criteria_max_score,
      criteria_lead_type: rule.criteria_lead_type || [],
      assign_to_org: rule.assign_to_org,
      auto_enrich: rule.auto_enrich,
      send_webhook: rule.send_webhook,
      webhook_url: rule.webhook_url || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    const data = {
      ...formData,
      criteria_industry: formData.criteria_industry.length > 0 ? formData.criteria_industry : null,
      criteria_state: formData.criteria_state.length > 0 ? formData.criteria_state : null,
      criteria_lead_type: formData.criteria_lead_type.length > 0 ? formData.criteria_lead_type : null,
      webhook_url: formData.send_webhook ? formData.webhook_url : null,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleArrayItem = (arr: string[], item: string): string[] => {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
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
          <h3 className="text-lg font-semibold">Lead Routing Rules</h3>
          <p className="text-sm text-muted-foreground">
            Auto-assign leads to organizations based on criteria
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit' : 'Create'} Routing Rule</DialogTitle>
              <DialogDescription>
                Define criteria for automatic lead assignment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Texas Real Estate"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority (higher = first)</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Match States (click to select)</Label>
                <div className="flex flex-wrap gap-1 p-2 border rounded-md max-h-32 overflow-y-auto">
                  {US_STATES.map(state => (
                    <Badge
                      key={state}
                      variant={formData.criteria_state.includes(state) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setFormData({
                        ...formData,
                        criteria_state: toggleArrayItem(formData.criteria_state, state)
                      })}
                    >
                      {state}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Match Industries</Label>
                <div className="flex flex-wrap gap-1">
                  {INDUSTRIES.map(ind => (
                    <Badge
                      key={ind}
                      variant={formData.criteria_industry.includes(ind) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setFormData({
                        ...formData,
                        criteria_industry: toggleArrayItem(formData.criteria_industry, ind)
                      })}
                    >
                      {ind}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Match Lead Types</Label>
                <div className="flex flex-wrap gap-1">
                  {LEAD_TYPES.map(type => (
                    <Badge
                      key={type}
                      variant={formData.criteria_lead_type.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setFormData({
                        ...formData,
                        criteria_lead_type: toggleArrayItem(formData.criteria_lead_type, type)
                      })}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Score</Label>
                  <Input
                    type="number"
                    value={formData.criteria_min_score ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      criteria_min_score: e.target.value ? parseInt(e.target.value) : null
                    })}
                    placeholder="Any"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Score</Label>
                  <Input
                    type="number"
                    value={formData.criteria_max_score ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      criteria_max_score: e.target.value ? parseInt(e.target.value) : null
                    })}
                    placeholder="Any"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign to Organization</Label>
                <Select
                  value={formData.assign_to_org || 'none'}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    assign_to_org: value === 'none' ? null : value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {organizations?.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Actions</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.auto_enrich}
                      onCheckedChange={(checked) => setFormData({ ...formData, auto_enrich: checked })}
                    />
                    <Label className="flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Auto-enrich matched leads
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.send_webhook}
                      onCheckedChange={(checked) => setFormData({ ...formData, send_webhook: checked })}
                    />
                    <Label className="flex items-center gap-1">
                      <Webhook className="h-3 w-3" /> Send webhook notification
                    </Label>
                  </div>
                </div>
              </div>

              {formData.send_webhook && (
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
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
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant="outline">Priority: {rule.priority}</Badge>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {rule.criteria_state && rule.criteria_state.length > 0 && (
                        <Badge variant="outline">
                          States: {rule.criteria_state.slice(0, 3).join(', ')}
                          {rule.criteria_state.length > 3 && ` +${rule.criteria_state.length - 3}`}
                        </Badge>
                      )}
                      {rule.criteria_industry && rule.criteria_industry.length > 0 && (
                        <Badge variant="outline">
                          Industries: {rule.criteria_industry.slice(0, 2).join(', ')}
                          {rule.criteria_industry.length > 2 && ` +${rule.criteria_industry.length - 2}`}
                        </Badge>
                      )}
                      {rule.criteria_min_score !== null && (
                        <Badge variant="outline">Score ≥ {rule.criteria_min_score}</Badge>
                      )}
                      
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      
                      {rule.assign_to_org && (
                        <Badge variant="secondary">
                          <Building className="h-3 w-3 mr-1" />
                          {organizations?.find(o => o.id === rule.assign_to_org)?.name || 'Org'}
                        </Badge>
                      )}
                      {rule.auto_enrich && <Badge variant="secondary"><Zap className="h-3 w-3 mr-1" />Enrich</Badge>}
                      {rule.send_webhook && <Badge variant="secondary"><Webhook className="h-3 w-3 mr-1" />Webhook</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(rule.id)}>
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
            <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No routing rules configured</p>
            <p className="text-sm">Create rules to auto-assign leads to organizations</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
