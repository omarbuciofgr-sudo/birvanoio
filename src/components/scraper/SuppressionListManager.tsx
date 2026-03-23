import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Ban, Globe, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SuppressionEntry, ClientOrganization } from '@/types/scraper';

interface SuppressionListManagerProps {
  organizations?: ClientOrganization[];
}

export function SuppressionListManager({ organizations = [] }: SuppressionListManagerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('global');
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [newEntry, setNewEntry] = useState({ type: 'email' as 'email' | 'phone' | 'domain', value: '', reason: '' });

  // Fetch global suppression list
  const { data: globalList = [], isLoading: globalLoading } = useQuery({
    queryKey: ['suppression-global'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppression_list_global')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SuppressionEntry[];
    },
  });

  // Fetch client suppression list
  const { data: clientList = [], isLoading: clientLoading } = useQuery({
    queryKey: ['suppression-client', selectedOrg],
    queryFn: async () => {
      if (!selectedOrg) return [];
      const { data, error } = await supabase
        .from('suppression_list_client')
        .select('*')
        .eq('organization_id', selectedOrg)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SuppressionEntry[];
    },
    enabled: !!selectedOrg,
  });

  // Add global entry
  const addGlobalMutation = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('suppression_list_global').insert({
        suppression_type: entry.type,
        value: entry.value.toLowerCase().trim(),
        reason: entry.reason || null,
        added_by: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Entry added to global suppression list');
      queryClient.invalidateQueries({ queryKey: ['suppression-global'] });
      setNewEntry({ type: 'email', value: '', reason: '' });
    },
    onError: (error: Error) => {
      toast.error('Failed to add entry: ' + error.message);
    },
  });

  // Add client entry
  const addClientMutation = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      if (!selectedOrg) throw new Error('No organization selected');
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('suppression_list_client').insert({
        organization_id: selectedOrg,
        suppression_type: entry.type,
        value: entry.value.toLowerCase().trim(),
        reason: entry.reason || null,
        added_by: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Entry added to client suppression list');
      queryClient.invalidateQueries({ queryKey: ['suppression-client', selectedOrg] });
      setNewEntry({ type: 'email', value: '', reason: '' });
    },
    onError: (error: Error) => {
      toast.error('Failed to add entry: ' + error.message);
    },
  });

  // Delete entry
  const deleteMutation = useMutation({
    mutationFn: async ({ id, isGlobal }: { id: string; isGlobal: boolean }) => {
      const table = isGlobal ? 'suppression_list_global' : 'suppression_list_client';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { isGlobal }) => {
      toast.success('Entry removed from suppression list');
      if (isGlobal) {
        queryClient.invalidateQueries({ queryKey: ['suppression-global'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['suppression-client', selectedOrg] });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to remove entry: ' + error.message);
    },
  });

  const handleAddEntry = () => {
    if (!newEntry.value.trim()) {
      toast.error('Please enter a value');
      return;
    }

    if (activeTab === 'global') {
      addGlobalMutation.mutate(newEntry);
    } else {
      addClientMutation.mutate(newEntry);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'domain': return <Globe className="h-4 w-4" />;
      default: return <Ban className="h-4 w-4" />;
    }
  };

  const renderList = (list: SuppressionEntry[], isGlobal: boolean, isLoading: boolean) => (
    <div className="space-y-4">
      {/* Add new entry form */}
      <div className="flex gap-2 items-end">
        <div className="space-y-1 w-32">
          <Label>Type</Label>
          <Select
            value={newEntry.type}
            onValueChange={(v) => setNewEntry({ ...newEntry, type: v as 'email' | 'phone' | 'domain' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="domain">Domain</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1">
          <Label>Value</Label>
          <Input
            value={newEntry.value}
            onChange={(e) => setNewEntry({ ...newEntry, value: e.target.value })}
            placeholder={newEntry.type === 'email' ? 'email@example.com' : newEntry.type === 'phone' ? '+1234567890' : 'example.com'}
          />
        </div>
        <div className="space-y-1 flex-1">
          <Label>Reason (optional)</Label>
          <Input
            value={newEntry.reason}
            onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
            placeholder="Why is this suppressed?"
          />
        </div>
        <Button onClick={handleAddEntry} disabled={addGlobalMutation.isPending || addClientMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {/* List table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No suppression entries yet
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    {getTypeIcon(entry.suppression_type)}
                    {entry.suppression_type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{entry.value}</TableCell>
                <TableCell className="text-muted-foreground">{entry.reason || '-'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(entry.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate({ id: entry.id, isGlobal })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-5 w-5" />
          Suppression Lists
        </CardTitle>
        <CardDescription>
          Manage global and per-client suppression lists. Suppressed leads cannot be assigned or exported.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="global">Global ({globalList.length})</TabsTrigger>
            <TabsTrigger value="client">Per-Client</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-4">
            {renderList(globalList, true, globalLoading)}
          </TabsContent>

          <TabsContent value="client" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Select Organization</Label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose an organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedOrg && renderList(clientList, false, clientLoading)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
