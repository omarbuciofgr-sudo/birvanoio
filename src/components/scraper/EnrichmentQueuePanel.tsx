import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { 
  ListTodo, 
  Play, 
  Pause, 
  RotateCcw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface QueueJob {
  id: string;
  job_type: string;
  reference_id: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  payload: {
    lead_ids?: string[];
    enrich_email?: boolean;
    enrich_phone?: boolean;
    validate_email?: boolean;
    validate_phone?: boolean;
  } | null;
  result: Record<string, unknown> | null;
}

export function EnrichmentQueuePanel() {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch queue jobs
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['enrichment-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_queue')
        .select('*')
        .in('job_type', ['enrich_lead', 'validate_lead', 'bulk_enrich'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as QueueJob[];
    },
    refetchInterval: isProcessing ? 2000 : 10000,
  });

  // Queue stats
  const pendingJobs = jobs.filter(j => j.status === 'pending').length;
  const processingJobs = jobs.filter(j => j.status === 'processing').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;

  // Add bulk enrichment job
  const addBulkJobMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      // Split into batches of 10
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < leadIds.length; i += batchSize) {
        batches.push(leadIds.slice(i, i + batchSize));
      }

      // Create jobs for each batch
      const jobInserts = batches.map((batch, index) => ({
        job_type: 'bulk_enrich',
        reference_id: crypto.randomUUID(),
        priority: 0,
        payload: {
          lead_ids: batch,
          enrich_email: true,
          enrich_phone: true,
          validate_email: true,
          validate_phone: true,
        },
        status: 'pending',
        max_attempts: 3,
      }));

      const { error } = await supabase
        .from('job_queue')
        .insert(jobInserts);

      if (error) throw error;
      return batches.length;
    },
    onSuccess: (count) => {
      toast.success(`Added ${count} enrichment jobs to queue`);
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
    },
    onError: (error) => {
      toast.error('Failed to add jobs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  // Retry failed job
  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('job_queue')
        .update({
          status: 'pending',
          attempts: 0,
          error_message: null,
          next_attempt_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job queued for retry');
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
    },
  });

  // Cancel pending job
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('job_queue')
        .update({ status: 'cancelled' })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Job cancelled');
      queryClient.invalidateQueries({ queryKey: ['enrichment-queue'] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge className="bg-primary/10 text-primary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'enrich_lead': return 'Single Enrich';
      case 'validate_lead': return 'Validation';
      case 'bulk_enrich': return 'Bulk Enrich';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingJobs}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-blue-500" />
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processingJobs}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedJobs}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedJobs}</div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Enrichment Queue
              </CardTitle>
              <CardDescription>
                Background job processing for lead enrichment and validation
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsProcessing(!isProcessing)}
              >
                {isProcessing ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop Auto-Refresh
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Auto-Refresh
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertDescription>
                No jobs in queue. Enrich leads from the Leads tab to add jobs.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => (
                <div 
                  key={job.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {getStatusBadge(job.status)}
                    <div>
                      <div className="font-medium text-sm">
                        {getJobTypeLabel(job.job_type)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {job.payload?.lead_ids?.length || 1} lead(s) • 
                        Attempt {job.attempts}/{job.max_attempts} • 
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </div>
                      {job.error_message && (
                        <div className="text-xs text-destructive mt-1">
                          {job.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retryJobMutation.mutate(job.id)}
                        disabled={retryJobMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    {job.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelJobMutation.mutate(job.id)}
                        disabled={cancelJobMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
