import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Download,
  Save,
  Loader2,
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';
import { CompanyResult } from '@/lib/api/industrySearch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCredits, CREDIT_COSTS } from '@/hooks/useCredits';
import { EnrichmentActionsPanel } from './EnrichmentActionsPanel';

function CompanyLogo({ domain, name }: { domain: string | null | undefined; name: string }) {
  const [errored, setErrored] = useState(false);

  const cleanDomain = (() => {
    if (!domain) return null;
    try {
      const d = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      return d || null;
    } catch {
      return null;
    }
  })();

  if (!cleanDomain || errored) {
    return (
      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-muted-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`}
      alt=""
      className="h-6 w-6 rounded flex-shrink-0 object-contain"
      onError={() => setErrored(true)}
    />
  );
}

interface SearchResultsProps {
  results: CompanyResult[];
  selectedRows: Set<number>;
  onSelectionChange: (selected: Set<number>) => void;
  isLoading: boolean;
  hasSearched: boolean;
  onSave: () => void;
  onExport: () => void;
  isSaving: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMoreResults?: boolean;
  totalResults?: number;
}

function getTypeBadge(types: string[], industry: string | null): string {
  if (types.includes('public')) return 'Public Company';
  if (types.includes('nonprofit')) return 'Non Profit';
  if (types.includes('privately_held')) return 'Privately Held';
  if (industry?.toLowerCase().includes('non-profit') || industry?.toLowerCase().includes('nonprofit')) return 'Non Profit';
  return 'Privately Held';
}

function formatSize(count: number | null, range: string | null): string {
  if (range) return range;
  if (!count) return '—';
  if (count >= 10001) return '10,001+ employees';
  if (count >= 5001) return '5,001-10,000 employees';
  if (count >= 1001) return '1,001-5,000 employees';
  if (count >= 501) return '501-1,000 employees';
  if (count >= 201) return '201-500 employees';
  if (count >= 51) return '51-200 employees';
  if (count >= 11) return '11-50 employees';
  return '1-10 employees';
}

type EnrichmentStatus = 'idle' | 'loading' | 'done' | 'error';

interface EnrichmentResult {
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  linkedin_url?: string | null;
}

export function SearchResults({
  results,
  selectedRows,
  onSelectionChange,
  isLoading,
  hasSearched,
  onSave,
  onExport,
  isSaving,
  onLoadMore,
  isLoadingMore,
  hasMoreResults,
  totalResults,
}: SearchResultsProps) {
  const { canAfford, spendCredits } = useCredits();
  const [enrichmentStatus, setEnrichmentStatus] = useState<Record<number, EnrichmentStatus>>({});
  const [enrichmentData, setEnrichmentData] = useState<Record<number, EnrichmentResult>>({});

  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    onSelectionChange(newSelected);
  };

  const toggleAll = () => {
    if (selectedRows.size === results.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(results.map((_, i) => i)));
    }
  };

  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [showActionsPanel, setShowActionsPanel] = useState(true);

  const handleEnrich = useCallback(async (index: number, company: CompanyResult) => {
    if (enrichmentStatus[index] === 'loading' || enrichmentStatus[index] === 'done') return;

    if (!canAfford('enrich')) {
      toast.error('Not enough credits for enrichment. Please upgrade your plan.');
      return;
    }

    setEnrichmentStatus(prev => ({ ...prev, [index]: 'loading' }));

    try {
      const domain = company.domain?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null;
      if (!domain) {
        toast.error(`No domain found for ${company.name}`);
        setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
        return;
      }

      // Spend credits
      const spent = await spendCredits('enrich', 1, `enrich_${domain}`);
      if (!spent) {
        toast.error('Failed to charge credits');
        setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
        return;
      }

      // Call waterfall enrichment
      const { data, error } = await supabase.functions.invoke('data-waterfall-enrich', {
        body: {
          domain,
          target_titles: ['owner', 'ceo', 'founder', 'president'],
        },
      });

      if (error || !data?.success) {
        setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
        toast.error(`Enrichment failed for ${company.name}`);
        return;
      }

      const enriched = data.data || {};
      setEnrichmentData(prev => ({
        ...prev,
        [index]: {
          email: enriched.email || null,
          phone: enriched.phone || enriched.mobile_phone || null,
          contact_name: enriched.full_name || null,
          linkedin_url: enriched.linkedin_url || null,
        },
      }));
      setEnrichmentStatus(prev => ({ ...prev, [index]: 'done' }));
      toast.success(`Enriched ${company.name}`);
    } catch {
      setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
      toast.error(`Enrichment failed for ${company.name}`);
    }
  }, [enrichmentStatus, canAfford, spendCredits]);

  const handleEnrichSelected = useCallback(async () => {
    if (bulkEnriching) return;
    const toEnrich = Array.from(selectedRows).filter(
      (i) => (enrichmentStatus[i] || 'idle') === 'idle'
    );
    if (toEnrich.length === 0) {
      toast.info('No un-enriched rows selected.');
      return;
    }
    if (!canAfford('enrich', toEnrich.length)) {
      toast.error(`Not enough credits. Need ${toEnrich.length * CREDIT_COSTS.enrich} credits.`);
      return;
    }
    setBulkEnriching(true);
    for (const idx of toEnrich) {
      await handleEnrich(idx, results[idx]);
    }
    setBulkEnriching(false);
    toast.success(`Enriched ${toEnrich.length} companies.`);
  }, [bulkEnriching, selectedRows, enrichmentStatus, canAfford, handleEnrich, results]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">Searching companies…</p>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-5 py-3 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2 max-w-xs">
            <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground">
              Select filters on the left and click <span className="font-medium text-foreground">Next</span> to preview results.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-5 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground">No results found. Try broadening your filters.</p>
          </div>
        </div>
      </div>
    );
  }

  const importCount = selectedRows.size > 0 ? selectedRows.size : results.length;

  const selectedCompany = selectedRows.size === 1 ? results[Array.from(selectedRows)[0]] : null;

  return (
    <div className="h-full flex bg-background">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Preview</h3>
          {selectedRows.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnrichSelected}
              disabled={bulkEnriching}
              className="text-xs h-7 gap-1.5 border-border/60"
            >
              {bulkEnriching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Enrich {selectedRows.size} selected
              <Badge variant="outline" className="text-[9px] py-0 px-1 ml-0.5 font-normal border-border/60">
                {selectedRows.size * CREDIT_COSTS.enrich} cr
              </Badge>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-primary font-medium">
            Previewing {results.length} results. {importCount.toLocaleString()} will be imported.
          </span>
          <button
            onClick={() => setShowActionsPanel(!showActionsPanel)}
            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={showActionsPanel ? 'Hide actions panel' : 'Show actions panel'}
          >
            {showActionsPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1100px]">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
              <tr className="border-b border-border/60">
                <th className="w-12 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === results.length && results.length > 0}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                  />
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Name
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Description
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Primary Industry
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">#</span> Employees
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Type
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    Enrich
                    <Badge variant="outline" className="text-[9px] py-0 px-1 ml-1 font-normal border-border/60">
                      {CREDIT_COSTS.enrich} cr
                    </Badge>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((company, index) => {
                const isSelected = selectedRows.has(index);
                const status = enrichmentStatus[index] || 'idle';
                const enriched = enrichmentData[index];
                return (
                  <tr
                    key={index}
                    className={`border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleRow(index)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(index)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <CompanyLogo domain={company.domain || company.website} name={company.name} />
                        <span className="truncate">{company.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[260px]">
                      <span className="truncate block text-xs">
                        {company.description
                          ? company.description.length > 60
                            ? company.description.slice(0, 60) + '…'
                            : company.description
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="truncate block text-xs">{company.industry || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatSize(company.employee_count, company.employee_range)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {getTypeBadge([], company.industry)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {status === 'idle' && (
                        <button
                          onClick={() => handleEnrich(index, company)}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors group"
                        >
                          <Play className="h-3 w-3 group-hover:text-primary" />
                          <span className="group-hover:text-primary">Click to run</span>
                        </button>
                      )}
                      {status === 'loading' && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Enriching…
                        </span>
                      )}
                      {status === 'done' && enriched && (
                        <div className="space-y-0.5">
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {enriched.contact_name || 'Contact found'}
                          </span>
                          {enriched.email && (
                            <span className="text-[11px] text-muted-foreground truncate block max-w-[160px]">{enriched.email}</span>
                          )}
                          {enriched.phone && (
                            <span className="text-[11px] text-muted-foreground">{enriched.phone}</span>
                          )}
                        </div>
                      )}
                      {status === 'done' && !enriched && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </span>
                      )}
                      {status === 'error' && (
                        <button
                          onClick={() => {
                            setEnrichmentStatus(prev => ({ ...prev, [index]: 'idle' }));
                            handleEnrich(index, company);
                          }}
                          className="flex items-center gap-1.5 text-destructive hover:text-destructive/80 transition-colors"
                        >
                          <XCircle className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Load More button */}
              {hasMoreResults && onLoadMore && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onLoadMore}
                      disabled={isLoadingMore}
                      className="text-xs h-8 gap-1.5"
                    >
                      {isLoadingMore ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {isLoadingMore ? 'Loading more…' : `Load more results${totalResults ? ` (${totalResults.toLocaleString()} total)` : ''}`}
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedRows.size > 0
            ? `${selectedRows.size} of ${results.length} selected`
            : `${results.length} results${totalResults && totalResults > results.length ? ` of ${totalResults.toLocaleString()}` : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport} className="text-xs h-8 gap-1.5 border-border/60">
            <Download className="h-3 w-3" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || selectedRows.size === 0}
            className="text-xs h-8 gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Import {selectedRows.size > 0 ? `${selectedRows.size} leads` : ''}
          </Button>
        </div>
      </div>
      </div>

      {/* Enrichment Actions Panel */}
      {showActionsPanel && (
        <EnrichmentActionsPanel
          selectedCompany={selectedCompany}
          selectedRows={selectedRows}
          results={results}
        />
      )}
    </div>
  );
}
