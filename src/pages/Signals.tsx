import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Zap, Plus, Search, Trash2, Loader2, Pause, Play } from 'lucide-react';

const QUICK_START_SIGNALS = [
  { type: 'job_change', label: 'Job change', icon: '🔄', description: 'Track when a prospect changes jobs' },
  { type: 'new_hire', label: 'New hire', icon: '👥', description: 'Monitor when companies make key hires' },
  { type: 'job_posting', label: 'Job posting', icon: '🎯', description: 'Detect relevant job postings' },
  { type: 'promotion', label: 'Promotion', icon: '🔺', description: 'Track when prospects get promoted' },
  { type: 'web_intent', label: 'Web intent', icon: '🌐', description: 'Detect buying signals from web activity' },
  { type: 'news_fundraising', label: 'News & fundraising', icon: '🎉', description: 'Monitor funding rounds and company news' },
  { type: 'linkedin_mention', label: 'LinkedIn post brand mentions', icon: '🟦', description: 'Track brand mentions in LinkedIn posts' },
  { type: 'custom', label: 'Custom', icon: '⚙️', description: 'Create a custom signal with your own rules' },
];

const FREQUENCY_OPTIONS = [
  { value: 'real_time', label: 'Real-time' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
];

export default function Signals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedQuickStart, setSelectedQuickStart] = useState<string | null>(null);
  const [newSignal, setNewSignal] = useState({
    name: '', signal_type: 'custom', folder: '', frequency: 'real_time',
    notify_email: true, notify_in_app: true,
  });

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['signal-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('signal_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('signal_subscriptions').insert({
        user_id: user!.id,
        name: newSignal.name || QUICK_START_SIGNALS.find(s => s.type === newSignal.signal_type)?.label || 'New Signal',
        signal_type: newSignal.signal_type,
        folder: newSignal.folder || null,
        frequency: newSignal.frequency,
        notify_email: newSignal.notify_email,
        notify_in_app: newSignal.notify_in_app,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signal-subscriptions'] });
      toast.success('Signal created');
      setCreateOpen(false);
      setNewSignal({ name: '', signal_type: 'custom', folder: '', frequency: 'real_time', notify_email: true, notify_in_app: true });
      setSelectedQuickStart(null);
    },
    onError: () => toast.error('Failed to create signal'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('signal_subscriptions').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signal-subscriptions'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('signal_subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signal-subscriptions'] });
      toast.success('Signal deleted');
    },
  });

  const handleQuickStart = (type: string) => {
    const signal = QUICK_START_SIGNALS.find(s => s.type === type);
    if (signal) {
      setNewSignal(prev => ({ ...prev, signal_type: type, name: signal.label }));
      setSelectedQuickStart(type);
      setCreateOpen(true);
    }
  };

  const filteredSubs = subscriptions.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Quick Start */}
        <div>
          <p className="text-xs text-muted-foreground mb-3 font-medium">Quick start</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_START_SIGNALS.map(signal => (
              <button
                key={signal.type}
                onClick={() => handleQuickStart(signal.type)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/60 transition-colors text-sm"
              >
                <span>{signal.icon}</span>
                <span className="font-medium">{signal.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Signals Table */}
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                <h3 className="text-base font-bold">Signals</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search signals..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 w-[200px] text-xs"
                  />
                </div>
                <Button size="sm" className="gap-1.5 text-xs bg-primary hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> New signal
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSubs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                You haven't created any signals yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Folder</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Monthly Matches</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubs.map(sub => {
                    const qsInfo = QUICK_START_SIGNALS.find(s => s.type === sub.signal_type);
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{qsInfo?.icon || '⚡'}</span>
                            {sub.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{sub.folder || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{sub.signal_type.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{sub.frequency.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={sub.is_active ? 'default' : 'secondary'} className="text-xs">
                            {sub.is_active ? 'Active' : 'Paused'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{sub.monthly_matches}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => toggleMutation.mutate({ id: sub.id, is_active: !sub.is_active })}
                              title={sub.is_active ? 'Pause' : 'Resume'}
                            >
                              {sub.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                              onClick={() => deleteMutation.mutate(sub.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Signal Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Signal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Signal Name</Label>
              <Input
                value={newSignal.name}
                onChange={e => setNewSignal(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., CTO job changes at target accounts"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Signal Type</Label>
              <Select value={newSignal.signal_type} onValueChange={v => setNewSignal(prev => ({ ...prev, signal_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUICK_START_SIGNALS.map(s => (
                    <SelectItem key={s.type} value={s.type}>{s.icon} {s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Folder (optional)</Label>
              <Input
                value={newSignal.folder}
                onChange={e => setNewSignal(prev => ({ ...prev, folder: e.target.value }))}
                placeholder="e.g., Sales, Marketing"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={newSignal.frequency} onValueChange={v => setNewSignal(prev => ({ ...prev, frequency: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={newSignal.notify_in_app} onCheckedChange={v => setNewSignal(prev => ({ ...prev, notify_in_app: v }))} />
                <Label className="text-xs">In-app notifications</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newSignal.notify_email} onCheckedChange={v => setNewSignal(prev => ({ ...prev, notify_email: v }))} />
                <Label className="text-xs">Email alerts</Label>
              </div>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Signal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
