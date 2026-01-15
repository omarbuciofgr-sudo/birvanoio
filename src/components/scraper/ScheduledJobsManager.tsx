import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduledJobsApi, ScheduledScrapeJob } from '@/lib/api/scraperFeatures';
import { schemaTemplatesApi } from '@/lib/api/scraper';
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
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Calendar, Clock, Play, Loader2, CheckCircle } from 'lucide-react';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ScheduledJobsManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledScrapeJob | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    schedule_type: 'daily',
    schedule_hour: 9,
    schedule_day_of_week: 1,
    schedule_day_of_month: 1,
    target_urls: '',
    schema_template_id: null as string | null,
    input_method: 'url_list',
    search_query: '',
    search_location: '',
    max_results: 50,
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['scheduled-jobs'],
    queryFn: () => scheduledJobsApi.list(),
  });

  const { data: templates } = useQuery({
    queryKey: ['schema-templates'],
    queryFn: () => schemaTemplatesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ScheduledScrapeJob>) => scheduledJobsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      toast.success('Scheduled job created');
      resetForm();
    },
    onError: (error) => toast.error(`Failed to create job: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScheduledScrapeJob> }) =>
      scheduledJobsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      toast.success('Scheduled job updated');
      resetForm();
    },
    onError: (error) => toast.error(`Failed to update job: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduledJobsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      toast.success('Scheduled job deleted');
    },
    onError: (error) => toast.error(`Failed to delete job: ${error.message}`),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => scheduledJobsApi.runNow(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      if (data.scrape_job_id) {
        toast.success('Job started successfully');
      } else {
        toast.info('Job queued');
      }
    },
    onError: (error) => toast.error(`Failed to run job: ${error.message}`),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      schedule_type: 'daily',
      schedule_hour: 9,
      schedule_day_of_week: 1,
      schedule_day_of_month: 1,
      target_urls: '',
      schema_template_id: null,
      input_method: 'url_list',
      search_query: '',
      search_location: '',
      max_results: 50,
    });
    setEditingJob(null);
    setDialogOpen(false);
  };

  const handleEdit = (job: ScheduledScrapeJob) => {
    setEditingJob(job);
    setFormData({
      name: job.name,
      description: job.description || '',
      is_active: job.is_active,
      schedule_type: job.schedule_type,
      schedule_hour: job.schedule_hour,
      schedule_day_of_week: job.schedule_day_of_week || 1,
      schedule_day_of_month: job.schedule_day_of_month || 1,
      target_urls: (job.target_urls || []).join('\n'),
      schema_template_id: job.schema_template_id,
      input_method: job.input_method,
      search_query: job.search_query || '',
      search_location: job.search_location || '',
      max_results: job.max_results,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Job name is required');
      return;
    }

    const urls = formData.target_urls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (formData.input_method === 'url_list' && urls.length === 0) {
      toast.error('At least one target URL is required');
      return;
    }

    const data: Partial<ScheduledScrapeJob> = {
      name: formData.name,
      description: formData.description || null,
      is_active: formData.is_active,
      schedule_type: formData.schedule_type,
      schedule_hour: formData.schedule_hour,
      schedule_day_of_week: formData.schedule_type === 'weekly' ? formData.schedule_day_of_week : null,
      schedule_day_of_month: formData.schedule_type === 'monthly' ? formData.schedule_day_of_month : null,
      target_urls: urls,
      schema_template_id: formData.schema_template_id,
      input_method: formData.input_method,
      search_query: formData.search_query || null,
      search_location: formData.search_location || null,
      max_results: formData.max_results,
    };

    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getScheduleDescription = (job: ScheduledScrapeJob): string => {
    const hour = job.schedule_hour.toString().padStart(2, '0') + ':00';
    switch (job.schedule_type) {
      case 'hourly':
        return 'Every hour';
      case 'daily':
        return `Daily at ${hour}`;
      case 'weekly':
        return `${DAYS_OF_WEEK[job.schedule_day_of_week || 0]}s at ${hour}`;
      case 'monthly':
        return `Day ${job.schedule_day_of_month} of each month at ${hour}`;
      default:
        return job.schedule_type;
    }
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
          <h3 className="text-lg font-semibold">Scheduled Scrape Jobs</h3>
          <p className="text-sm text-muted-foreground">
            Run scraping jobs on a recurring schedule
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingJob ? 'Edit' : 'Create'} Scheduled Job</DialogTitle>
              <DialogDescription>
                Configure a recurring scrape job
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Job Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Daily Real Estate Scrape"
                />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Schedule Type</Label>
                  <Select
                    value={formData.schedule_type}
                    onValueChange={(value) => setFormData({ ...formData, schedule_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.schedule_type !== 'hourly' && (
                  <div className="space-y-2">
                    <Label>Run at Hour (0-23)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.schedule_hour}
                      onChange={(e) => setFormData({ ...formData, schedule_hour: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>

              {formData.schedule_type === 'weekly' && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={formData.schedule_day_of_week.toString()}
                    onValueChange={(value) => setFormData({ ...formData, schedule_day_of_week: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.schedule_type === 'monthly' && (
                <div className="space-y-2">
                  <Label>Day of Month (1-28)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={formData.schedule_day_of_month}
                    onChange={(e) => setFormData({ ...formData, schedule_day_of_month: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Schema Template</Label>
                <Select
                  value={formData.schema_template_id || 'none'}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    schema_template_id: value === 'none' ? null : value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (General)</SelectItem>
                    {templates?.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target URLs (one per line)</Label>
                <Textarea
                  value={formData.target_urls}
                  onChange={(e) => setFormData({ ...formData, target_urls: e.target.value })}
                  placeholder="https://example.com&#10;https://another.com"
                  rows={4}
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
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingJob ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <Card key={job.id} className={!job.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">{job.name}</span>
                      <Badge variant={job.is_active ? 'default' : 'secondary'}>
                        {job.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {getScheduleDescription(job)}
                      </Badge>
                      <Badge variant="outline">
                        {job.target_urls?.length || 0} URLs
                      </Badge>
                      <Badge variant="outline">
                        Runs: {job.run_count}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {job.last_run_at && (
                        <span>Last: {format(new Date(job.last_run_at), 'MMM d, HH:mm')}</span>
                      )}
                      {job.next_run_at && (
                        <span>Next: {format(new Date(job.next_run_at), 'MMM d, HH:mm')}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runNowMutation.mutate(job.id)}
                      disabled={runNowMutation.isPending}
                    >
                      {runNowMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(job)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(job.id)}>
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
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No scheduled jobs configured</p>
            <p className="text-sm">Create a schedule to run scraping jobs automatically</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
