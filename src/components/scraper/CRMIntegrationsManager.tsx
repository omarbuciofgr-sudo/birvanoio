import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Link2, Trash2, RefreshCw, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

interface CRMIntegration {
  id: string;
  name: string;
  crm_type: 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho' | 'custom';
  api_key_secret_name: string | null;
  instance_url: string | null;
  auto_sync_enabled: boolean;
  sync_on_status: string[];
  field_mapping: Record<string, string>;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  leads_synced_count: number;
}

const CRM_TYPES = [
  { value: 'salesforce', label: 'Salesforce', color: 'bg-blue-500' },
  { value: 'hubspot', label: 'HubSpot', color: 'bg-orange-500' },
  { value: 'pipedrive', label: 'Pipedrive', color: 'bg-green-500' },
  { value: 'zoho', label: 'Zoho CRM', color: 'bg-yellow-500' },
  { value: 'custom', label: 'Custom API', color: 'bg-gray-500' },
];

const LEAD_STATUSES = [
  'new', 'review', 'approved', 'assigned', 'in_progress', 'won', 'lost', 'rejected'
];

const DEFAULT_FIELD_MAPPING = {
  full_name: 'Name',
  best_email: 'Email',
  best_phone: 'Phone',
  domain: 'Website',
  address: 'Address',
  lead_score: 'Lead_Score',
};

export function CRMIntegrationsManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    crm_type: 'hubspot' as const,
    instance_url: '',
    api_key_secret_name: '',
    auto_sync_enabled: false,
    sync_on_status: ['approved', 'assigned'] as string[],
  });

  // Fetch integrations
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['crm-integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_integrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CRMIntegration[];
    },
  });

  // Create integration
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('crm_integrations').insert({
        ...newIntegration,
        field_mapping: DEFAULT_FIELD_MAPPING,
        created_by: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-integrations'] });
      setIsDialogOpen(false);
      setNewIntegration({
        name: '',
        crm_type: 'hubspot',
        instance_url: '',
        api_key_secret_name: '',
        auto_sync_enabled: false,
        sync_on_status: ['approved', 'assigned'],
      });
      toast.success('CRM integration created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle integration
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('crm_integrations')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-integrations'] });
    },
  });

  // Delete integration
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_integrations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-integrations'] });
      toast.success('Integration deleted');
    },
  });

  // Manual sync
  const syncIntegration = async (integration: CRMIntegration) => {
    setSyncingId(integration.id);
    try {
      const { error } = await supabase.functions.invoke('sync-crm', {
        body: { integration_id: integration.id },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['crm-integrations'] });
      toast.success('Sync initiated');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const toggleSyncStatus = (status: string) => {
    setNewIntegration(prev => ({
      ...prev,
      sync_on_status: prev.sync_on_status.includes(status)
        ? prev.sync_on_status.filter(s => s !== status)
        : [...prev.sync_on_status, status],
    }));
  };

  const getCRMColor = (type: string) => {
    return CRM_TYPES.find(c => c.value === type)?.color || 'bg-gray-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            CRM Integrations
          </h2>
          <p className="text-sm text-muted-foreground">
            Sync leads automatically to Salesforce, HubSpot, or other CRMs
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add CRM Integration</DialogTitle>
              <DialogDescription>
                Connect your CRM to automatically sync leads
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Integration Name</Label>
                <Input
                  placeholder="e.g., Production HubSpot"
                  value={newIntegration.name}
                  onChange={e => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>CRM Type</Label>
                <Select
                  value={newIntegration.crm_type}
                  onValueChange={v => setNewIntegration(prev => ({ ...prev, crm_type: v as typeof prev.crm_type }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${type.color}`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Instance URL (if applicable)</Label>
                <Input
                  placeholder="https://yourcompany.hubspot.com"
                  value={newIntegration.instance_url}
                  onChange={e => setNewIntegration(prev => ({ ...prev, instance_url: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>API Key Secret Name</Label>
                <Input
                  placeholder="HUBSPOT_API_KEY"
                  value={newIntegration.api_key_secret_name}
                  onChange={e => setNewIntegration(prev => ({ ...prev, api_key_secret_name: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  The name of the secret storing your API key (configure in settings)
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Auto-Sync</Label>
                <Switch
                  checked={newIntegration.auto_sync_enabled}
                  onCheckedChange={checked => setNewIntegration(prev => ({ ...prev, auto_sync_enabled: checked }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sync When Lead Status Is:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAD_STATUSES.map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={status}
                        checked={newIntegration.sync_on_status.includes(status)}
                        onCheckedChange={() => toggleSyncStatus(status)}
                      />
                      <label htmlFor={status} className="text-sm capitalize cursor-pointer">
                        {status.replace('_', ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newIntegration.name || !newIntegration.api_key_secret_name}
              >
                Create Integration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {integrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No CRM integrations configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your CRM to automatically push leads
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map(integration => (
            <Card key={integration.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${getCRMColor(integration.crm_type)} flex items-center justify-center`}>
                      <Link2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <CardDescription className="capitalize">{integration.crm_type}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={integration.is_active}
                    onCheckedChange={is_active => toggleMutation.mutate({ id: integration.id, is_active })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Auto-sync</span>
                  <Badge variant={integration.auto_sync_enabled ? 'default' : 'secondary'}>
                    {integration.auto_sync_enabled ? 'Enabled' : 'Manual'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Leads synced</span>
                  <span className="font-medium">{integration.leads_synced_count.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {integration.sync_error ? (
                    <div className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs">Error</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs">Connected</span>
                    </div>
                  )}
                </div>
                {integration.last_sync_at && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => syncIntegration(integration)}
                    disabled={syncingId === integration.id}
                  >
                    {syncingId === integration.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Sync Now
                  </Button>
                  {integration.instance_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={integration.instance_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(integration.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
