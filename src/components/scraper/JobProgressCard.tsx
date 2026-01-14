import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, StopCircle, Loader2 } from 'lucide-react';
import { ScrapeJob } from '@/types/scraper';

interface JobProgressCardProps {
  job: ScrapeJob;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

export function JobProgressCard({ job, onPause, onResume, onCancel }: JobProgressCardProps) {
  const progress = job.total_targets > 0 
    ? Math.round(((job.completed_targets + job.failed_targets) / job.total_targets) * 100) 
    : 0;

  const statusConfig = {
    running: { color: 'bg-blue-500', icon: Loader2, label: 'Running' },
    queued: { color: 'bg-yellow-500', icon: Loader2, label: 'Queued' },
    paused: { color: 'bg-orange-500', icon: Pause, label: 'Paused' },
  };

  const config = statusConfig[job.status as keyof typeof statusConfig];
  const Icon = config?.icon || Loader2;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{job.name}</CardTitle>
          <Badge variant="outline" className="gap-1">
            {job.status === 'running' ? (
              <Icon className="h-3 w-3 animate-spin" />
            ) : (
              <Icon className="h-3 w-3" />
            )}
            {config?.label || job.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {job.completed_targets + job.failed_targets} / {job.total_targets}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {job.failed_targets > 0 && (
            <p className="text-xs text-destructive">
              {job.failed_targets} failed targets
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="text-muted-foreground">Completed</p>
            <p className="font-medium text-green-600">{job.completed_targets}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Failed</p>
            <p className="font-medium text-destructive">{job.failed_targets}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Remaining</p>
            <p className="font-medium">{job.total_targets - job.completed_targets - job.failed_targets}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {job.status === 'running' && onPause && (
            <Button size="sm" variant="outline" onClick={onPause} className="flex-1">
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          )}
          {job.status === 'paused' && onResume && (
            <Button size="sm" variant="outline" onClick={onResume} className="flex-1">
              <Play className="h-4 w-4 mr-1" /> Resume
            </Button>
          )}
          {['running', 'paused', 'queued'].includes(job.status) && onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel} className="text-destructive">
              <StopCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
