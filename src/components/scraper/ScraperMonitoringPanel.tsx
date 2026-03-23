import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Trash2,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface BlockedDomain {
  id: string;
  domain: string;
  blocked_at: string;
  block_reason: string | null;
  http_status: number | null;
  retry_after: string | null;
  block_count: number;
  last_attempt_at: string;
}

interface DomainCache {
  id: string;
  domain: string;
  last_scraped_at: string;
  cache_expires_at: string;
  scraped_pages_count: number;
}

interface JobStats {
  total_jobs: number;
  running_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  total_targets: number;
  completed_targets: number;
  failed_targets: number;
  success_rate: number;
}

export function ScraperMonitoringPanel() {
  const queryClient = useQueryClient();

  // Fetch job statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['scraper-stats'],
    queryFn: async (): Promise<JobStats> => {
      const { data: jobs, error } = await supabase
        .from('scrape_jobs')
        .select('status, total_targets, completed_targets, failed_targets');
      
      if (error) throw error;

      const running = jobs?.filter(j => j.status === 'running').length || 0;
      const completed = jobs?.filter(j => j.status === 'completed').length || 0;
      const failed = jobs?.filter(j => j.status === 'failed').length || 0;
      const totalTargets = jobs?.reduce((sum, j) => sum + (j.total_targets || 0), 0) || 0;
      const completedTargets = jobs?.reduce((sum, j) => sum + (j.completed_targets || 0), 0) || 0;
      const failedTargets = jobs?.reduce((sum, j) => sum + (j.failed_targets || 0), 0) || 0;
      
      return {
        total_jobs: jobs?.length || 0,
        running_jobs: running,
        completed_jobs: completed,
        failed_jobs: failed,
        total_targets: totalTargets,
        completed_targets: completedTargets,
        failed_targets: failedTargets,
        success_rate: totalTargets > 0 ? Math.round((completedTargets / totalTargets) * 100) : 0,
      };
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch blocked domains
  const { data: blockedDomains = [], isLoading: blockedLoading } = useQuery({
    queryKey: ['blocked-domains'],
    queryFn: async (): Promise<BlockedDomain[]> => {
      const { data, error } = await supabase
        .from('blocked_domains')
        .select('*')
        .order('blocked_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return (data || []) as BlockedDomain[];
    },
  });

  // Fetch cached domains
  const { data: cachedDomains = [], isLoading: cacheLoading } = useQuery({
    queryKey: ['domain-cache'],
    queryFn: async (): Promise<DomainCache[]> => {
      const { data, error } = await supabase
        .from('domain_cache')
        .select('*')
        .order('last_scraped_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return (data || []) as DomainCache[];
    },
  });

  // Fetch active locks
  const { data: activeLocks = [] } = useQuery({
    queryKey: ['scraper-locks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraper_locks')
        .select('*')
        .gt('expires_at', new Date().toISOString());
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Clear expired cache
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('domain_cache')
        .delete()
        .lt('cache_expires_at', new Date().toISOString());
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-cache'] });
      toast.success('Expired cache cleared');
    },
    onError: (error) => toast.error(`Failed to clear cache: ${error.message}`),
  });

  // Unblock domain
  const unblockMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { error } = await supabase
        .from('blocked_domains')
        .delete()
        .eq('id', domainId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-domains'] });
      toast.success('Domain unblocked');
    },
    onError: (error) => toast.error(`Failed to unblock: ${error.message}`),
  });

  // Clear all blocked domains
  const clearBlockedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('blocked_domains')
        .delete()
        .lt('retry_after', new Date().toISOString());
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-domains'] });
      toast.success('Retryable domains cleared');
    },
    onError: (error) => toast.error(`Failed to clear: ${error.message}`),
  });

  const globalConcurrency = activeLocks.filter(l => l.lock_type === 'global').length;
  const domainConcurrency = activeLocks.filter(l => l.lock_type === 'domain').length;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_jobs || 0}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {stats?.running_jobs || 0} running
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.success_rate || 0}%</div>
            <Progress value={stats?.success_rate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Targets Processed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.completed_targets || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {stats?.total_targets || 0}
              </span>
            </div>
            <div className="text-xs text-destructive mt-1">
              {stats?.failed_targets || 0} failed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalConcurrency}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {domainConcurrency} domains locked
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="blocked" className="space-y-4">
        <TabsList>
          <TabsTrigger value="blocked" className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            Blocked Domains
            {blockedDomains.length > 0 && (
              <Badge variant="destructive" className="ml-1">{blockedDomains.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cache" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Cache
            <Badge variant="secondary" className="ml-1">{cachedDomains.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="locks" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Active Locks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blocked">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Blocked Domains</CardTitle>
                <CardDescription>
                  Domains that returned errors or were rate-limited
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => clearBlockedMutation.mutate()}
                disabled={blockedDomains.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Retryable
              </Button>
            </CardHeader>
            <CardContent>
              {blockedLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : blockedDomains.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  No blocked domains
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Blocked At</TableHead>
                      <TableHead>Retry After</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockedDomains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell className="font-medium">{domain.domain}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {domain.block_reason || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {domain.http_status && (
                            <Badge variant={domain.http_status >= 500 ? 'destructive' : 'secondary'}>
                              {domain.http_status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{domain.block_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(domain.blocked_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {domain.retry_after 
                            ? format(new Date(domain.retry_after), 'MMM d, HH:mm')
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unblockMutation.mutate(domain.id)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Domain Cache</CardTitle>
                <CardDescription>
                  Recently scraped domains (cached results available)
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => clearCacheMutation.mutate()}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Expired
              </Button>
            </CardHeader>
            <CardContent>
              {cacheLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : cachedDomains.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cached domains
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Pages Scraped</TableHead>
                      <TableHead>Last Scraped</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cachedDomains.map((cache) => {
                      const isExpired = new Date(cache.cache_expires_at) < new Date();
                      return (
                        <TableRow key={cache.id}>
                          <TableCell className="font-medium">{cache.domain}</TableCell>
                          <TableCell>{cache.scraped_pages_count}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(cache.last_scraped_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(cache.cache_expires_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isExpired ? 'secondary' : 'default'}>
                              {isExpired ? 'Expired' : 'Active'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locks">
          <Card>
            <CardHeader>
              <CardTitle>Active Locks</CardTitle>
              <CardDescription>
                Current concurrency locks preventing duplicate processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeLocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active locks
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Locked By</TableHead>
                      <TableHead>Locked At</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLocks.map((lock) => (
                      <TableRow key={lock.id}>
                        <TableCell>
                          <Badge variant={lock.lock_type === 'global' ? 'default' : 'outline'}>
                            {lock.lock_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{lock.lock_key}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lock.locked_by || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(lock.locked_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(lock.expires_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
