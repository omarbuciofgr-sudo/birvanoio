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
import { Plus, HardDrive, Trash2, Play, Loader2, CheckCircle2, XCircle, Download, Cloud } from 'lucide-react';

interface BackupJob {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number;
  hour: number;
  destination_type: 'email' | 's3' | 'gcs' | 'azure';
  destination_config: Record<string, unknown>;
  include_leads: boolean;
  include_analytics: boolean;
  include_audit_log: boolean;
  export_format: 'csv' | 'json' | 'xlsx';
  lead_status_filter: string[] | null;
  date_range_days: number;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_record_count: number | null;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function BackupJobsManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [newJob, setNewJob] = useState({
    name: '',
    frequency: 'weekly' as const,
    day_of_week: 0,
    hour: 2,
    destination_type: 'email' as const,
    destination_email: '',
    include_leads: true,
    include_analytics: true,
    include_audit_log: false,
    export_format: 'csv' as const,
    date_range_days: 30,
  });

  // Fetch backup jobs
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['backup-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BackupJob[];
    },
  });

  // Create job
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('backup_jobs').insert({
        name: newJob.name,
        frequency: newJob.frequency,
        day_of_week: newJob.day_of_week,
        hour: newJob.hour,
        destination_type: newJob.destination_type,
        destination_config: { email: newJob.destination_email },
        include_leads: newJob.include_leads,
        include_analytics: newJob.include_analytics,
        include_audit_log: newJob.include_audit_log,
        export_format: newJob.export_format,
        date_range_days: newJob.date_range_days,
        created_by: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
      setIsDialogOpen(false);
      setNewJob({
        name: '',
        frequency: 'weekly',
        day_of_week: 0,
        hour: 2,
        destination_type: 'email',
        destination_email: '',
        include_leads: true,
        include_analytics: true,
        include_audit_log: false,
        export_format: 'csv',
        date_range_days: 30,
      });
      toast.success('Backup job created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle job
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('backup_jobs')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
    },
  });

  // Delete job
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('backup_jobs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
      toast.success('Backup job deleted');
    },
  });

  // Run backup now
  const runBackup = async (job: BackupJob) => {
    setRunningId(job.id);
    try {
      const { error } = await supabase.functions.invoke('run-backup', {
        body: { job_id: job.id },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
      toast.success('Backup started');
    } catch {
      toast.error('Failed to start backup');
    } finally {
      setRunningId(null);
    }
  };

  const getDestinationIcon = (type: string) => {
    switch (type) {
      case 'email': return '📧';
      case 's3': return '☁️';
      case 'gcs': return '🌐';
      case 'azure': return '💠';
      default: return '📁';
    }
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
            <HardDrive className="h-5 w-5" />
            Automated Backups
          </h2>
          <p className="text-sm text-muted-foreground">
            Schedule automatic data exports to email or cloud storage
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Backup Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Backup Job</DialogTitle>
              <DialogDescription>
                Schedule automatic exports of your lead data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                <Label>Job Name</Label>
                <Input
                  placeholder="e.g., Weekly Lead Export"
                  value={newJob.name}
                  onChange={e => setNewJob(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={newJob.frequency}
                    onValueChange={v => setNewJob(prev => ({ ...prev, frequency: v as typeof prev.frequency }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newJob.frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <Select
                      value={String(newJob.day_of_week)}
                      onValueChange={v => setNewJob(prev => ({ ...prev, day_of_week: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day, i) => (
                          <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time (UTC)</Label>
                  <Select
                    value={String(newJob.hour)}
                    onValueChange={v => setNewJob(prev => ({ ...prev, hour: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map(h => (
                        <SelectItem key={h} value={String(h)}>
                          {h.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Export Format</Label>
                  <Select
                    value={newJob.export_format}
                    onValueChange={v => setNewJob(prev => ({ ...prev, export_format: v as typeof prev.export_format }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Destination Email</Label>
                <Input
                  type="email"
                  placeholder="backups@yourcompany.com"
                  value={newJob.destination_email}
                  onChange={e => setNewJob(prev => ({ ...prev, destination_email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Range (days)</Label>
                <Input
                  type="number"
                  value={newJob.date_range_days}
                  onChange={e => setNewJob(prev => ({ ...prev, date_range_days: parseInt(e.target.value) || 30 }))}
                  min={1}
                  max={365}
                />
              </div>
              <div className="space-y-3">
                <Label>Include:</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include_leads"
                      checked={newJob.include_leads}
                      onCheckedChange={checked => setNewJob(prev => ({ ...prev, include_leads: !!checked }))}
                    />
                    <label htmlFor="include_leads" className="text-sm cursor-pointer">Lead data</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include_analytics"
                      checked={newJob.include_analytics}
                      onCheckedChange={checked => setNewJob(prev => ({ ...prev, include_analytics: !!checked }))}
                    />
                    <label htmlFor="include_analytics" className="text-sm cursor-pointer">Analytics & metrics</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include_audit_log"
                      checked={newJob.include_audit_log}
                      onCheckedChange={checked => setNewJob(prev => ({ ...prev, include_audit_log: !!checked }))}
                    />
                    <label htmlFor="include_audit_log" className="text-sm cursor-pointer">Audit log</label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newJob.name || !newJob.destination_email}
              >
                Create Job
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No backup jobs configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a backup job to automatically export your data
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map(job => (
            <Card key={job.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{getDestinationIcon(job.destination_type)}</div>
                    <div>
                      <CardTitle className="text-base">{job.name}</CardTitle>
                      <CardDescription className="capitalize">
                        {job.frequency} • {job.export_format.toUpperCase()}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={job.is_active}
                    onCheckedChange={is_active => toggleMutation.mutate({ id: job.id, is_active })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {job.include_leads && <Badge variant="secondary" className="text-xs">Leads</Badge>}
                  {job.include_analytics && <Badge variant="secondary" className="text-xs">Analytics</Badge>}
                  {job.include_audit_log && <Badge variant="secondary" className="text-xs">Audit Log</Badge>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Schedule</span>
                  <span>
                    {job.frequency === 'weekly' && `${DAYS_OF_WEEK[job.day_of_week]}s `}
                    at {job.hour.toString().padStart(2, '0')}:00 UTC
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last run</span>
                  {job.last_run_at ? (
                    <div className="flex items-center gap-1">
                      {job.last_run_status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-xs">
                        {new Date(job.last_run_at).toLocaleDateString()}
                        {job.last_run_record_count && ` (${job.last_run_record_count} records)`}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Never</span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => runBackup(job)}
                    disabled={runningId === job.id}
                  >
                    {runningId === job.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    Run Now
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(job.id)}
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
