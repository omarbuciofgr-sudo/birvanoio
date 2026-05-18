import { useState, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Download,
  Save,
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  PanelRightOpen,
  PanelRightClose,
  FileText,
  Globe,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Github,
} from 'lucide-react';
import { CompanyResult } from '@/lib/api/industrySearch';
import { toast } from 'sonner';
import { invokeWaterfallEnrich } from '@/lib/api/waterfallEnrich';
import { PeopleBulkEnrichBar, PeopleRowStatusIcon } from '@/components/prospect-search/PeopleBulkEnrichBar';
import {
  derivePeopleRowSignals,
  normalizeDomain,
  type PeopleSkipReasonCode,
} from '@/components/prospect-search/peopleRowReadiness';
import { useCredits, CREDIT_COSTS } from '@/hooks/useCredits';
import { EnrichmentActionsPanel } from './EnrichmentActionsPanel';
import { CompanyDetailSheet } from './CompanyDetailSheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function CompanyLogo({ domain, name }: { domain: string | null | undefined; name: string }) {
  const cleanDomain = (() => {
    if (!domain) return null;
    try {
      const d = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      return d || null;
    } catch {
      return null;
    }
  })();

  const initial =
    (cleanDomain && /^[a-z0-9]/i.test(cleanDomain) ? cleanDomain.charAt(0) : name.charAt(0)).toUpperCase();

  return (
    <div
      className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0"
      title={cleanDomain || name}
    >
      <span className="text-[10px] font-bold text-muted-foreground">{initial}</span>
    </div>
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
  /** People Search rows need Apollo people/match + person context */
  enrichmentTarget?: 'company' | 'person';
  /**
   * People preview: merge enrichment into in-memory rows until Import saves leads.
   * Matches Flask vs Edge forwarding rules in `waterfallEnrich.ts` (org→domain needs Flask or Edge forward).
   */
  onPatchResults?: (patches: Array<{ index: number; patch: Partial<CompanyResult> }>) => void;
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
  enrichmentTarget = 'company',
  onPatchResults,
}: SearchResultsProps) {
  const isPerson = enrichmentTarget === 'person';
  /** Person: checkbox + Details + Bulk + Name + Employer + LinkedIn + Domain + … + Enrich; company: checkbox + Details + Name + Domain + … */
  const tableColSpan = isPerson ? 16 : 11;
  const { canAfford, spendCredits } = useCredits();
  const [enrichmentStatus, setEnrichmentStatus] = useState<Record<number, EnrichmentStatus>>({});
  const [enrichmentData, setEnrichmentData] = useState<Record<number, EnrichmentResult>>({});
  const [peopleRowMeta, setPeopleRowMeta] = useState<
    Record<number, { code: PeopleSkipReasonCode; detail?: string }>
  >({});
  const [peopleBulkRunning, setPeopleBulkRunning] = useState(false);

  useEffect(() => {
    setPeopleRowMeta({});
  }, [enrichmentTarget]);

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
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const handleEnrich = useCallback(async (index: number, company: CompanyResult) => {
    if (peopleBulkRunning) return;
    if (enrichmentStatus[index] === 'loading' || enrichmentStatus[index] === 'done') return;

    if (!canAfford('enrich')) {
      toast.error('Not enough credits for enrichment. Please upgrade your plan.');
      return;
    }

    setEnrichmentStatus(prev => ({ ...prev, [index]: 'loading' }));

    try {
      const domain =
        company.domain?.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim() || '';
      const orgName = (company.organization_name || '').trim();
      const li = (company.linkedin_url || '').trim();
      if (enrichmentTarget === 'person') {
        if (!domain && !orgName && !li && !company.name?.trim()) {
          toast.error(`Nothing to match for ${company.name} — add LinkedIn or organization if possible.`);
          setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
          return;
        }
      } else if (!domain && !orgName) {
        toast.error(`No company domain or organization for ${company.name}`);
        setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
        return;
      }

      const spent = await spendCredits('enrich', 1, `enrich_${domain || orgName.slice(0, 48) || li.slice(0, 32) || 'row'}`);
      if (!spent) {
        toast.error('Failed to charge credits');
        setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
        return;
      }

      const { data, error } = await invokeWaterfallEnrich(
        {
          enrichment_target: enrichmentTarget,
          enrichment_mode: 'strict_b2b_v1',
          ...(domain ? { domain } : {}),
          ...(orgName ? { company_name: orgName } : {}),
          ...(enrichmentTarget === 'person' && company.name?.trim()
            ? { person_display_name: company.name.trim() }
            : {}),
          ...(enrichmentTarget === 'person' && li ? { linkedin_url: li } : {}),
          target_titles: ['owner', 'ceo', 'founder', 'president'],
        },
        { maxRetriesOn429: 3 },
      );

      if (error || !data?.success) {
        setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
        toast.error(
          error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            `Enrichment failed for ${company.name}`
        );
        return;
      }

      const enriched = (data.data || {}) as Record<string, any>;
      setEnrichmentData(prev => ({
        ...prev,
        [index]: {
          email: String(enriched.email || '') || '',
          phone: String(enriched.phone || enriched.mobile_phone || '') || '',
          contact_name: String(enriched.full_name || '') || '',
          linkedin_url: String(enriched.linkedin_url || '') || '',
        } as EnrichmentResult,
      }));
      if (enrichmentTarget === 'person' && onPatchResults) {
        const patch: Partial<CompanyResult> = {};
        const dom = normalizeDomain(String(enriched.domain || ''));
        if (dom) {
          patch.domain = dom;
          patch.website = `https://${dom}`;
        }
        const ind = String(enriched.industry || '').trim();
        if (ind) patch.industry = ind;
        const em = String(enriched.email || '').trim();
        if (em) patch.email = em;
        const ph = String(enriched.phone || enriched.mobile_phone || '').trim();
        if (ph) {
          patch.phone = ph;
          const mob = String(enriched.mobile_phone || '').trim();
          if (mob) patch.mobile_phone = mob;
        }
        if (Object.keys(patch).length > 0) onPatchResults([{ index, patch }]);
      }
      setEnrichmentStatus(prev => ({ ...prev, [index]: 'done' }));
      toast.success(`Enriched ${company.name}`);
    } catch {
      setEnrichmentStatus(prev => ({ ...prev, [index]: 'error' }));
      toast.error(`Enrichment failed for ${company.name}`);
    }
  }, [
    enrichmentStatus,
    canAfford,
    spendCredits,
    enrichmentTarget,
    onPatchResults,
    peopleBulkRunning,
  ]);

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
      if (peopleBulkRunning) break;
      await handleEnrich(idx, results[idx]);
    }
    setBulkEnriching(false);
    toast.success(
      enrichmentTarget === 'person'
        ? `Finished quick enrich on ${toEnrich.length} row(s). Check the “Quick enrich” column for status.`
        : `Enriched ${toEnrich.length} companies.`,
    );
  }, [bulkEnriching, selectedRows, enrichmentStatus, canAfford, handleEnrich, results, peopleBulkRunning, enrichmentTarget]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">
            {isPerson ? 'Searching people…' : 'Searching companies…'}
          </p>
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
      <div className="flex-shrink-0 px-5 py-3 border-b border-border/60 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Preview</h3>
            {isPerson && (
              <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0 h-5">
                People
              </Badge>
            )}
          </div>
          {selectedRows.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnrichSelected}
              disabled={bulkEnriching || peopleBulkRunning}
              className="text-xs h-7 gap-1.5 border-border/60"
              title="Runs the single-row “Click to run” enrich on each checked row (credits per row). This is not the same as the footer buttons, which fill domain / industry / email / phone from the provider and update the table in bulk."
            >
              {bulkEnriching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Quick enrich · {selectedRows.size} row{selectedRows.size === 1 ? '' : 's'}
              <Badge variant="outline" className="text-[9px] py-0 px-1 ml-0.5 font-normal border-border/60">
                {selectedRows.size * CREDIT_COSTS.enrich} cr
              </Badge>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            {results.length} in preview ·{' '}
            <span className="text-foreground font-medium">{importCount.toLocaleString()} will import</span>
            {selectedRows.size > 0 ? (
              <span className="text-muted-foreground"> ({selectedRows.size} checked)</span>
            ) : null}
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

      {isPerson && (
        <div className="flex-shrink-0 px-5 py-2.5 border-b border-border/50 bg-muted/25 text-[11px] leading-snug text-muted-foreground">
          <p className="font-medium text-foreground/90 text-xs mb-1.5">How this screen works</p>
          <ul className="grid gap-1.5 sm:grid-cols-3 list-none m-0 p-0">
            <li className="rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5">
              <span className="text-foreground font-medium">Table</span> — Rows are your search hits. Scroll horizontally to see all columns (none stay pinned). Nothing is saved as a lead until you use{' '}
              <span className="text-foreground font-medium">Import</span>.
            </li>
            <li className="rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5">
              <span className="text-foreground font-medium">Quick enrich</span> (header) — One paid enrich action per checked row. Different from the footer tools.
            </li>
            <li className="rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5">
              <span className="text-foreground font-medium">Footer tools</span> — Fill domain, industry, email, or phone in the table. The{' '}
              <span className="text-foreground font-medium">Last run</span> column shows green / amber / gray after each run.
            </li>
          </ul>
        </div>
      )}
      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto overscroll-x-contain">
        <div className={`shrink-0 ${isPerson ? 'min-w-[2020px]' : 'min-w-[1520px]'}`}>
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-muted border-b border-border/60 shadow-sm">
              <tr className="border-b border-border/60">
                <th className="w-12 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === results.length && results.length > 0}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                  />
                </th>
                <th
                  className="w-11 px-1 py-2.5 text-center text-xs font-medium text-muted-foreground"
                  title="Open row details (employer, LinkedIn, domain, enrichment). You can also double-click a row."
                >
                  <span className="sr-only">Details</span>
                  <FileText className="h-3.5 w-3.5 opacity-70 mx-auto" aria-hidden />
                </th>
                {isPerson && (
                  <th
                    className="w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] px-1 py-2.5 text-left text-xs font-medium text-muted-foreground"
                    title="Shows the result of the last footer action on this row. Green = OK, amber = skipped or error (hover the icon). Gray = not run yet."
                  >
                    <span className="flex flex-col leading-tight gap-0.5">
                      <span className="text-[10px] font-semibold text-foreground/90">Last run</span>
                      <span className="text-[9px] font-normal text-muted-foreground">footer</span>
                    </span>
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {isPerson ? (
                    'Name'
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="text-primary font-semibold">T</span> Name
                    </span>
                  )}
                </th>
                {/* Person preview: identity fields aligned with peopleRowReadiness (org + person LI) — after Name, before Domain */}
                {isPerson && (
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground max-w-[140px]">
                    Employer
                  </th>
                )}
                {isPerson && (
                  <th
                    className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground max-w-[160px]"
                    title="Person LinkedIn profile URL from search. Opens in a new tab when present."
                  >
                    LinkedIn
                  </th>
                )}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground max-w-[160px]">
                  Domain
                </th>
                <th
                  className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                  title={isPerson ? 'Usually title and employer from search (helps you recognize the row).' : undefined}
                >
                  {isPerson ? (
                    'Role / headline'
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="text-primary font-semibold">T</span> Description
                    </span>
                  )}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {isPerson ? (
                    'Industry'
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="text-primary font-semibold">T</span> Primary Industry
                    </span>
                  )}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {isPerson ? (
                    'Employees'
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="text-primary font-semibold">#</span> Employees
                    </span>
                  )}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {isPerson ? 'Location' : (
                    <span className="flex items-center gap-1">
                      <span className="text-primary font-semibold">📍</span> Location
                    </span>
                  )}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {isPerson ? 'Links' : (
                    <span className="flex items-center gap-1">
                      <span className="text-primary font-semibold">🔗</span> Links
                    </span>
                  )}
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {isPerson ? 'Company type' : (
                    <span className="flex items-center gap-1">
                      <span className="text-primary font-semibold">T</span> Type
                    </span>
                  )}
                </th>
                {isPerson && (
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground max-w-[140px]">
                    Work email
                  </th>
                )}
                {isPerson && (
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground max-w-[120px]">
                    Phone
                  </th>
                )}
                <th
                  className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                  title={
                    isPerson
                      ? 'Same as “Quick enrich” in the header: one paid enrich for this row only (not the footer batch tools).'
                      : 'Runs a one-row Apollo-style enrich (credits). Separate from the footer bulk buttons, which update many rows.'
                  }
                >
                  {isPerson ? (
                    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>Quick enrich</span>
                      <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal border-border/60">
                        {CREDIT_COSTS.enrich} cr
                      </Badge>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      Enrich
                      <Badge variant="outline" className="text-[9px] py-0 px-1 ml-1 font-normal border-border/60">
                        {CREDIT_COSTS.enrich} cr
                      </Badge>
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((company, index) => {
                const isSelected = selectedRows.has(index);
                const status = enrichmentStatus[index] || 'idle';
                const enriched = enrichmentData[index];
                const sig = derivePeopleRowSignals(company);
                const rowMeta = peopleRowMeta[index];
                return (
                  <tr
                    key={index}
                    className={`border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleRow(index)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      window.getSelection()?.removeAllRanges();
                      setDetailIndex(index);
                    }}
                    title="Double-click row or use Details to open the side panel"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(index)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-1 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="View details: employer, LinkedIn, domain, description, enrichment"
                        aria-label={`View details for ${company.name || 'row'}`}
                        onClick={() => setDetailIndex(index)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                    {isPerson && (
                      <td
                        className="px-2 py-3 align-middle w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <PeopleRowStatusIcon
                                  code={rowMeta?.code}
                                  detail={rowMeta?.detail}
                                  warnMissingLinkedin={
                                    !sig.hasDomain &&
                                    !sig.hasPersonLinkedIn &&
                                    (sig.hasOrgName || sig.hasPersonName)
                                  }
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[320px] text-xs whitespace-pre-wrap">
                              {rowMeta?.code
                                ? `${rowMeta.code}${rowMeta.detail ? `\n${rowMeta.detail}` : ''}`
                                : 'Green = last footer step succeeded for this row. Amber = skipped or provider error (hover for code). Gray = footer has not run yet.\nUse Resolve / Industry / Email / Phone or Enrich all (pipeline).'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium max-w-[180px]">
                      <div className="flex min-w-0 items-center gap-2">
                        <CompanyLogo domain={company.domain || company.website} name={company.name} />
                        <span className="truncate">{company.name}</span>
                      </div>
                    </td>
                    {isPerson && (
                      <td className="px-3 py-3 text-xs text-muted-foreground max-w-[140px]">
                        {(() => {
                          const org = (company.organization_name || '').trim();
                          if (org) {
                            return (
                              <span className="truncate block" title={org}>
                                {org}
                              </span>
                            );
                          }
                          return (
                            <span
                              className="text-muted-foreground cursor-help"
                              title="No employer name from the people search API for this row. If your Description looks like “Role at Company”, try re-running search or use bulk Resolve once you have other signals."
                            >
                              —
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    {isPerson && (
                      <td
                        className="px-3 py-3 text-xs max-w-[160px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const raw = (company.linkedin_url || '').trim();
                          if (!raw) {
                            return (
                              <span
                                className="text-muted-foreground cursor-help"
                                title="People search did not return a LinkedIn URL for this person. Footer bulk steps can still use employer name + person name when the provider supports it."
                              >
                                —
                              </span>
                            );
                          }
                          const label = raw.length > 42 ? `${raw.slice(0, 39)}…` : raw;
                          return (
                            <a
                              href={raw}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate block text-primary hover:underline max-w-full"
                              title={raw}
                            >
                              {label}
                            </a>
                          );
                        })()}
                      </td>
                    )}
                    <td
                      className="px-3 py-3 text-xs max-w-[160px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {normalizeDomain(company.domain) ? (
                        <a
                          href={company.website || `https://${normalizeDomain(company.domain)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate block text-primary hover:underline"
                          title={normalizeDomain(company.domain)}
                        >
                          {normalizeDomain(company.domain)}
                        </a>
                      ) : (
                        <span
                          className={cn('text-muted-foreground', isPerson && 'cursor-help')}
                          title={
                            isPerson
                              ? 'No company domain on this row. If Employer is filled, try footer → Resolve domains to look up a domain from the org name.'
                              : undefined
                          }
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[260px]">
                      {company.description ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block text-xs cursor-default">
                                {company.description.length > 60
                                  ? company.description.slice(0, 60) + '…'
                                  : company.description}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[360px] text-xs whitespace-normal">
                              {company.description}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="truncate block text-xs">{company.industry || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatSize(company.employee_count, company.employee_range)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[160px]">
                      <span className="truncate block">
                        {[company.headquarters_city, company.headquarters_state, company.headquarters_country].filter(Boolean).join(', ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {(company.website || company.domain) && (
                          <a href={company.website || `https://${company.domain}`} target="_blank" rel="noopener noreferrer"
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Website">
                            <Globe className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {company.linkedin_url && (
                          <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-primary transition-colors" title="LinkedIn">
                            <Linkedin className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {company.social_profiles?.twitter && (
                          <a href={company.social_profiles.twitter} target="_blank" rel="noopener noreferrer"
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Twitter/X">
                            <Twitter className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {company.social_profiles?.facebook && (
                          <a href={company.social_profiles.facebook} target="_blank" rel="noopener noreferrer"
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Facebook">
                            <Facebook className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {company.social_profiles?.instagram && (
                          <a href={company.social_profiles.instagram} target="_blank" rel="noopener noreferrer"
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Instagram">
                            <Instagram className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {company.social_profiles?.youtube && (
                          <a href={company.social_profiles.youtube} target="_blank" rel="noopener noreferrer"
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="YouTube">
                            <Youtube className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {company.social_profiles?.github && (
                          <a href={company.social_profiles.github} target="_blank" rel="noopener noreferrer"
                            className="h-6 w-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="GitHub">
                            <Github className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {!company.website && !company.domain && !company.linkedin_url && !company.social_profiles && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {getTypeBadge([], company.industry)}
                    </td>
                    {isPerson && (
                      <td className="px-3 py-3 text-xs max-w-[140px]" onClick={(e) => e.stopPropagation()}>
                        <span className="truncate block" title={company.email || enriched?.email || ''}>
                          {company.email || enriched?.email || '—'}
                        </span>
                      </td>
                    )}
                    {isPerson && (
                      <td className="px-3 py-3 text-xs max-w-[120px]" onClick={(e) => e.stopPropagation()}>
                        <span
                          className="truncate block"
                          title={
                            [company.phone || enriched?.phone, company.mobile_phone].filter(Boolean).join(' · ') ||
                            ''
                          }
                        >
                          {company.phone || enriched?.phone || '—'}
                          {company.mobile_phone ? (
                            <span className="text-muted-foreground block truncate">mob: {company.mobile_phone}</span>
                          ) : null}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {status === 'idle' && (
                        <button
                          onClick={() => handleEnrich(index, company)}
                          disabled={peopleBulkRunning}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors group disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Play className="h-3 w-3 group-hover:text-primary" />
                          <span className="group-hover:text-primary">
                            {isPerson ? 'Run quick enrich' : 'Click to run'}
                          </span>
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
                  <td colSpan={tableColSpan} className="px-4 py-4 text-center">
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
      <div className="flex-shrink-0 px-5 py-3 border-t border-border/60 bg-muted/30 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground shrink-0">Selection</span>
            <span>
              {selectedRows.size > 0
                ? `${selectedRows.size} of ${results.length} checked`
                : `${results.length} on this page${totalResults && totalResults > results.length ? ` (${totalResults.toLocaleString()} total)` : ''}`}
            </span>
          </div>
          {isPerson && onPatchResults && (
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Update cells from data providers
              </span>
              <PeopleBulkEnrichBar
              results={results}
              selectedRows={selectedRows}
              onPatchRows={onPatchResults}
              onMergeEnrichment={(patches) => {
                setEnrichmentData((prev) => {
                  const next = { ...prev };
                  for (const { index, patch } of patches) {
                    next[index] = { ...next[index], ...patch };
                  }
                  return next;
                });
              }}
              onRowMetaBatch={(patches) => {
                setPeopleRowMeta((prev) => {
                  const next = { ...prev };
                  for (const p of patches) {
                    next[p.index] = { code: p.code, detail: p.detail };
                  }
                  return next;
                });
              }}
              onRunningChange={setPeopleBulkRunning}
            />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 items-stretch sm:items-end shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-left sm:text-right">
            Save leads
          </span>
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
      </div>

      {/* Enrichment Actions Panel */}
      {showActionsPanel && (
        <EnrichmentActionsPanel
          selectedCompany={selectedCompany}
          selectedRows={selectedRows}
          results={results}
          enrichmentTarget={enrichmentTarget}
        />
      )}

      {/* Detail Sheet (Details button or double-click row) */}
      <CompanyDetailSheet
        open={detailIndex !== null}
        onOpenChange={(o) => !o && setDetailIndex(null)}
        company={detailIndex !== null ? results[detailIndex] : null}
        enrichmentTarget={enrichmentTarget}
        enrichment={detailIndex !== null ? enrichmentData[detailIndex] : undefined}
        enrichmentStatus={detailIndex !== null ? (enrichmentStatus[detailIndex] || 'idle') : 'idle'}
        onEnrich={detailIndex !== null ? () => handleEnrich(detailIndex, results[detailIndex]) : undefined}
      />
    </div>
  );
}
