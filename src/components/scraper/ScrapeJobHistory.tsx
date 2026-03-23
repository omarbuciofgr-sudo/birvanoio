import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { scrapeJobsApi, scrapedLeadsApi } from '@/lib/api/scraper';
import { ScrapeJob, ScrapeJobStatus } from '@/types/scraper';
import { toast } from 'sonner';
import { format, formatDistanceStrict, differenceInSeconds } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusColors: Record<ScrapeJobStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  queued: 'bg-yellow-500/20 text-yellow-600',
  running: 'bg-blue-500/20 text-blue-600',
  paused: 'bg-orange-500/20 text-orange-600',
  completed: 'bg-green-500/20 text-green-600',
  failed: 'bg-destructive/20 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const statusIcons: Record<ScrapeJobStatus, React.ReactNode> = {
  draft: null,
  queued: <Clock className="h-3 w-3" />,
  running: <Loader2 className="h-3 w-3 animate-spin" />,
  paused: <Clock className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  cancelled: <XCircle className="h-3 w-3" />,
};

function formatRuntime(job: ScrapeJob): string {
  if (!job.started_at) return '—';
  
  const startDate = new Date(job.started_at);
  const endDate = job.completed_at ? new Date(job.completed_at) : new Date();
  
  const seconds = differenceInSeconds(endDate, startDate);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function ScrapeJobHistory() {
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['scrape-jobs'],
    queryFn: () => scrapeJobsApi.list(),
  });

  // Filter to completed/failed/cancelled jobs for history
  const historyJobs = jobs
    .filter(j => ['completed', 'failed', 'cancelled'].includes(j.status))
    .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime());

  const handleExportCsv = async (job: ScrapeJob) => {
    try {
      setExportingJobId(job.id);
      const csvContent = await scrapedLeadsApi.exportToCsv({ job_id: job.id });
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${job.name.replace(/[^a-z0-9]/gi, '_')}_leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export CSV');
    } finally {
      setExportingJobId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading job history...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job History</CardTitle>
        <CardDescription>
          View completed, failed, and cancelled scrape jobs with runtime and export options
        </CardDescription>
      </CardHeader>
      <CardContent>
        {historyJobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No completed jobs yet. Run a scraping job to see history here.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="text-right">Export</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{job.name}</div>
                      {job.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {job.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[job.status]} flex items-center gap-1 w-fit`}>
                      {statusIcons[job.status]}
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.started_at 
                      ? format(new Date(job.started_at), 'MMM d, yyyy HH:mm')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {job.completed_at 
                      ? format(new Date(job.completed_at), 'MMM d, yyyy HH:mm')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatRuntime(job)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="text-green-600">{job.completed_targets}</span>
                      {job.failed_targets > 0 && (
                        <span className="text-destructive"> / {job.failed_targets} failed</span>
                      )}
                      <span className="text-muted-foreground"> of {job.total_targets}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportCsv(job)}
                      disabled={exportingJobId === job.id || job.completed_targets === 0}
                    >
                      {exportingJobId === job.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          CSV
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
