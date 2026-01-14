import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, StopCircle, Eye, Trash2, RefreshCw, Activity, History } from 'lucide-react';
import { scrapeJobsApi, schemaTemplatesApi } from '@/lib/api/scraper';
import { ScrapeJob, ScrapeJobStatus } from '@/types/scraper';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CreateJobDialog } from '@/components/scraper/CreateJobDialog';
import { JobProgressCard } from '@/components/scraper/JobProgressCard';
import { ScraperMonitoringPanel } from '@/components/scraper/ScraperMonitoringPanel';
import { ScrapeJobHistory } from '@/components/scraper/ScrapeJobHistory';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

const statusColors: Record<ScrapeJobStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  queued: 'bg-yellow-500/20 text-yellow-600',
  running: 'bg-blue-500/20 text-blue-600',
  paused: 'bg-orange-500/20 text-orange-600',
  completed: 'bg-green-500/20 text-green-600',
  failed: 'bg-destructive/20 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function ScrapeJobs() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<ScrapeJob | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['scrape-jobs'],
    queryFn: () => scrapeJobsApi.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['schema-templates'],
    queryFn: () => schemaTemplatesApi.list(),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => scrapeJobsApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
      toast.success('Job started');
    },
    onError: (error) => toast.error(`Failed to start job: ${error.message}`),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => scrapeJobsApi.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
      toast.success('Job paused');
    },
    onError: (error) => toast.error(`Failed to pause job: ${error.message}`),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => scrapeJobsApi.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
      toast.success('Job resumed');
    },
    onError: (error) => toast.error(`Failed to resume job: ${error.message}`),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => scrapeJobsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
      toast.success('Job cancelled');
    },
    onError: (error) => toast.error(`Failed to cancel job: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scrapeJobsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
      toast.success('Job deleted');
      setDeleteJobId(null);
    },
    onError: (error) => toast.error(`Failed to delete job: ${error.message}`),
  });

  const getJobActions = (job: ScrapeJob) => {
    const actions = [];

    if (job.status === 'draft') {
      actions.push(
        <Button key="start" size="sm" variant="outline" onClick={() => startMutation.mutate(job.id)}>
          <Play className="h-4 w-4 mr-1" /> Start
        </Button>
      );
    }

    if (job.status === 'running') {
      actions.push(
        <Button key="pause" size="sm" variant="outline" onClick={() => pauseMutation.mutate(job.id)}>
          <Pause className="h-4 w-4 mr-1" /> Pause
        </Button>
      );
    }

    if (job.status === 'paused') {
      actions.push(
        <Button key="resume" size="sm" variant="outline" onClick={() => resumeMutation.mutate(job.id)}>
          <RefreshCw className="h-4 w-4 mr-1" /> Resume
        </Button>
      );
    }

    if (['running', 'paused', 'queued'].includes(job.status)) {
      actions.push(
        <Button key="cancel" size="sm" variant="outline" onClick={() => cancelMutation.mutate(job.id)}>
          <StopCircle className="h-4 w-4 mr-1" /> Cancel
        </Button>
      );
    }

    actions.push(
      <Button key="view" size="sm" variant="ghost" onClick={() => setSelectedJob(job)}>
        <Eye className="h-4 w-4" />
      </Button>
    );

    if (['draft', 'completed', 'failed', 'cancelled'].includes(job.status)) {
      actions.push(
        <Button key="delete" size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteJobId(job.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    }

    return actions;
  };

  // Active jobs (running, queued, paused)
  const activeJobs = jobs.filter(j => ['running', 'queued', 'paused'].includes(j.status));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Scrape Jobs</h1>
            <p className="text-muted-foreground">Create and manage web scraping jobs</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Job
          </Button>
        </div>

        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-6">

        {/* Active Jobs Progress */}
        {activeJobs.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeJobs.map(job => (
              <JobProgressCard
                key={job.id}
                job={job}
                onPause={() => pauseMutation.mutate(job.id)}
                onResume={() => resumeMutation.mutate(job.id)}
                onCancel={() => cancelMutation.mutate(job.id)}
              />
            ))}
          </div>
        )}

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Jobs</CardTitle>
            <CardDescription>View and manage all scraping jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading jobs...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No jobs yet. Create your first scraping job.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Schema</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.name}</TableCell>
                      <TableCell>
                        {job.schema_template?.name || 'No template'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[job.status]}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {job.completed_targets + job.failed_targets} / {job.total_targets}
                        {job.failed_targets > 0 && (
                          <span className="text-destructive ml-1">({job.failed_targets} failed)</span>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(job.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {getJobActions(job)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="history">
          <ScrapeJobHistory />
        </TabsContent>

        <TabsContent value="monitoring">
          <ScraperMonitoringPanel />
        </TabsContent>
        </Tabs>

        {/* Create Job Dialog */}
        <CreateJobDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          templates={templates}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this job and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={() => deleteJobId && deleteMutation.mutate(deleteJobId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
