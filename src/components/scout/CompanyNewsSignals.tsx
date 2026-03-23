import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Newspaper, ExternalLink, TrendingUp, Users, Briefcase, Zap, Building2, Handshake, AlertTriangle } from 'lucide-react';
import { b2bToolsApi, NewsSignal } from '@/lib/api/b2bTools';

const SIGNAL_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  funding: { icon: TrendingUp, color: 'bg-green-500/10 text-green-600', label: 'Funding' },
  leadership_change: { icon: Users, color: 'bg-blue-500/10 text-blue-600', label: 'Leadership Change' },
  hiring_surge: { icon: Briefcase, color: 'bg-purple-500/10 text-purple-600', label: 'Hiring Surge' },
  acquisition: { icon: Building2, color: 'bg-orange-500/10 text-orange-600', label: 'Acquisition' },
  product_launch: { icon: Zap, color: 'bg-cyan-500/10 text-cyan-600', label: 'Product Launch' },
  expansion: { icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-600', label: 'Expansion' },
  layoff: { icon: AlertTriangle, color: 'bg-red-500/10 text-red-600', label: 'Layoff' },
  partnership: { icon: Handshake, color: 'bg-indigo-500/10 text-indigo-600', label: 'Partnership' },
};

interface CompanyNewsSignalsProps {
  /** Pre-populated companies from parent (e.g. from search results) */
  companies?: Array<{ name: string; domain: string }>;
}

export function CompanyNewsSignals({ companies: initialCompanies }: CompanyNewsSignalsProps) {
  const [signals, setSignals] = useState<NewsSignal[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useMutation({
    mutationFn: () => {
      if (!initialCompanies?.length) {
        toast.error('No companies to monitor');
        return Promise.reject('No companies');
      }
      return b2bToolsApi.getCompanySignals(initialCompanies);
    },
    onSuccess: (data) => {
      if (data.success && data.signals) {
        setSignals(data.signals);
        setHasSearched(true);
        toast.success(`Found ${data.signals.length} signals`);
      } else {
        toast.error(data.error || 'Failed to fetch signals');
      }
    },
    onError: () => toast.error('Failed to fetch signals'),
  });

  const filtered = filterType === 'all' ? signals : signals.filter(s => s.signal_type === filterType);

  const signalTypeCounts = signals.reduce((acc, s) => {
    acc[s.signal_type] = (acc[s.signal_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Header with scan button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Company News & Trigger Events</h3>
          {initialCompanies?.length && (
            <Badge variant="secondary" className="text-[10px]">
              {initialCompanies.length} companies
            </Badge>
          )}
        </div>
        <Button
          onClick={() => searchMutation.mutate()}
          disabled={searchMutation.isPending || !initialCompanies?.length}
          size="sm" className="gap-1.5 text-xs"
        >
          {searchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Newspaper className="h-3.5 w-3.5" />}
          Scan for signals
        </Button>
      </div>

      {/* Signal type filter chips */}
      {hasSearched && signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              filterType === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-muted/60'
            }`}
          >
            All ({signals.length})
          </button>
          {Object.entries(signalTypeCounts).map(([type, count]) => {
            const config = SIGNAL_CONFIG[type];
            if (!config) return null;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                  filterType === type ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-muted/60'
                }`}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Signals list */}
      {hasSearched && (
        <ScrollArea className="max-h-[500px]">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {signals.length === 0 ? 'No signals detected for these companies.' : 'No signals match the selected filter.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((signal, i) => {
                const config = SIGNAL_CONFIG[signal.signal_type] || SIGNAL_CONFIG.funding;
                const Icon = config.icon;
                return (
                  <Card key={i} className="border-border/40">
                    <CardContent className="p-3.5">
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold">{signal.company_name}</span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{config.label}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {Math.round(signal.confidence * 100)}% confidence
                            </span>
                          </div>
                          <p className="text-sm font-medium leading-tight">{signal.headline}</p>
                          {signal.summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{signal.summary}</p>
                          )}
                          {signal.source_url && (
                            <a href={signal.source_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1.5">
                              <ExternalLink className="h-2.5 w-2.5" /> View source
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
