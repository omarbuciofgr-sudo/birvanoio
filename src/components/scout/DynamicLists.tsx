import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { isOptionalTableMissing, markOptionalTableMissingOnError } from '@/integrations/supabase/optionalTables';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, ListFilter, Trash2, RefreshCw, Clock } from 'lucide-react';
import { format } from 'date-fns';

const DYNAMIC_LISTS_TABLE = 'dynamic_lists';

export function DynamicLists() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newList, setNewList] = useState({
    name: '',
    search_type: 'company' as string,
    auto_refresh: false,
    refresh_frequency: 'weekly' as string,
  });

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['dynamic-lists'],
    queryFn: async () => {
      if (isOptionalTableMissing(DYNAMIC_LISTS_TABLE)) return [];
      const { data, error, status } = await supabase
        .from(DYNAMIC_LISTS_TABLE)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        markOptionalTableMissingOnError(DYNAMIC_LISTS_TABLE, error, status);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isOptionalTableMissing(DYNAMIC_LISTS_TABLE)) return;
      const { error } = await supabase.from(DYNAMIC_LISTS_TABLE).insert({
        user_id: user!.id,
        name: newList.name,
        search_type: newList.search_type,
        auto_refresh: newList.auto_refresh,
        refresh_frequency: newList.refresh_frequency,
        filters: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-lists'] });
      toast.success('List created');
      setCreateOpen(false);
      setNewList({ name: '', search_type: 'company', auto_refresh: false, refresh_frequency: 'weekly' });
    },
    onError: () => toast.error('Failed to create list'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isOptionalTableMissing(DYNAMIC_LISTS_TABLE)) return;
      const { error } = await supabase.from(DYNAMIC_LISTS_TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-lists'] });
      toast.success('List deleted');
    },
  });

  const typeLabels: Record<string, string> = {
    company: 'Company', people: 'People', jobs: 'Jobs', technology: 'Tech Stack', lookalike: 'Lookalike',
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Dynamic Lists</h3>
            </div>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New list
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No dynamic lists yet. Create one to auto-track new matches.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Auto-refresh</TableHead>
                  <TableHead className="text-xs">Results</TableHead>
                  <TableHead className="text-xs">Last refreshed</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list: any) => (
                  <TableRow key={list.id}>
                    <TableCell className="font-medium text-sm">{list.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {typeLabels[list.search_type] || list.search_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {list.auto_refresh ? (
                        <Badge variant="default" className="text-[10px] gap-1">
                          <RefreshCw className="h-2.5 w-2.5" />
                          {list.refresh_frequency}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Off</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{list.result_count || 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {list.last_refreshed_at ? format(new Date(list.last_refreshed_at), 'MMM d, HH:mm') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(list.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Create dynamic list</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">List name</Label>
              <Input
                value={newList.name}
                onChange={e => setNewList(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. SaaS companies using HubSpot"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Search type</Label>
              <Select value={newList.search_type} onValueChange={v => setNewList(prev => ({ ...prev, search_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="people">People</SelectItem>
                  <SelectItem value="jobs">Jobs</SelectItem>
                  <SelectItem value="technology">Tech Stack</SelectItem>
                  <SelectItem value="lookalike">Lookalike</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto-refresh</Label>
              <Switch checked={newList.auto_refresh} onCheckedChange={v => setNewList(prev => ({ ...prev, auto_refresh: v }))} />
            </div>
            {newList.auto_refresh && (
              <div>
                <Label className="text-xs">Frequency</Label>
                <Select value={newList.refresh_frequency} onValueChange={v => setNewList(prev => ({ ...prev, refresh_frequency: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newList.name.trim()} className="w-full">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create list
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
