import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Loader2, Globe, Factory, Mail, Phone, Layers, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import type { CompanyResult } from '@/lib/api/industrySearch';
import { invokeWaterfallEnrich } from '@/lib/api/waterfallEnrich';
import { useCredits, CREDIT_COSTS } from '@/hooks/useCredits';
import { toast } from 'sonner';
import {
  contactEnrichPrecheck,
  derivePeopleRowSignals,
  formatPeopleReasonTooltip,
  industryEnrichPrecheck,
  normalizeDomain,
  PEOPLE_SKIP_REASON_COPY,
  resolveDomainPrecheck,
  type PeopleSkipReasonCode,
  waterfallPersonPrecheck,
} from '@/components/prospect-search/peopleRowReadiness';

export type BulkKind = 'resolve' | 'industry' | 'email' | 'phone';

const PIPELINE_STEPS: BulkKind[] = ['resolve', 'industry', 'email', 'phone'];

type BusyKind = BulkKind | 'pipeline';

type EnrichmentRowPatch = {
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  contact_name?: string | null;
  linkedin_url?: string | null;
};

const CONCURRENCY = 4;
const RETRY_429 = 3;

/** Merge person-level fields from enrichment into table row patches. */
function personPatchFromEnriched(enriched: Record<string, unknown>): Partial<CompanyResult> {
  const patch: Partial<CompanyResult> = {};
  const fn = String(enriched.full_name || '').trim();
  if (fn) patch.name = fn;
  const li = String(enriched.linkedin_url || '').trim();
  if (li) patch.linkedin_url = li;
  const dom = normalizeDomain(String(enriched.domain || ''));
  if (dom) {
    patch.domain = dom;
    patch.website = `https://${dom}`;
  }
  return patch;
}

function buildWaterfallBody(row: CompanyResult, enrichFields?: string[]) {
  const domain = normalizeDomain(row.domain);
  const orgName = (row.organization_name || '').trim();
  const li = (row.linkedin_url || '').trim();
  const body: Parameters<typeof invokeWaterfallEnrich>[0] = {
    enrichment_target: 'person',
    ...(domain ? { domain } : {}),
    ...(orgName ? { company_name: orgName } : {}),
    ...(row.name?.trim() ? { person_display_name: row.name.trim() } : {}),
    ...(li ? { linkedin_url: li } : {}),
    target_titles: ['owner', 'ceo', 'founder', 'president'],
  };
  if (enrichFields?.length) body.enrich_fields = enrichFields;
  const onlyCompanyDomain =
    enrichFields?.length === 1 && enrichFields[0].toLowerCase() === 'company_domain';
  if (!onlyCompanyDomain) {
    body.enrichment_mode = 'strict_b2b_v1';
  }
  return body;
}

async function runPool(
  indices: number[],
  limit: number,
  worker: (index: number) => Promise<void>,
  signal: AbortSignal | undefined,
): Promise<void> {
  const q = [...indices];
  const runWorker = async () => {
    while (q.length > 0) {
      if (signal?.aborted) return;
      const idx = q.shift();
      if (idx === undefined) return;
      await worker(idx);
    }
  };
  const n = Math.min(limit, Math.max(1, indices.length));
  await Promise.all(Array.from({ length: n }, () => runWorker()));
}

type Props = {
  results: CompanyResult[];
  selectedRows: Set<number>;
  onPatchRows: (patches: Array<{ index: number; patch: Partial<CompanyResult> }>) => void;
  onMergeEnrichment: (patches: Array<{ index: number; patch: Partial<EnrichmentRowPatch> }>) => void;
  onRowMetaBatch: (patches: Array<{ index: number; code: PeopleSkipReasonCode; detail?: string }>) => void;
  onRunningChange?: (running: boolean) => void;
};

export function PeopleBulkEnrichBar({
  results,
  selectedRows,
  onPatchRows,
  onMergeEnrichment,
  onRowMetaBatch,
  onRunningChange,
}: Props) {
  const { canAfford, spendCredits } = useCredits();
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const [busyKind, setBusyKind] = useState<BusyKind | null>(null);
  const [progress, setProgress] = useState<{ cur: number; total: number; phase?: BulkKind } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [pickScopeOpen, setPickScopeOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<BulkKind | null>(null);
  const [pendingPipeline, setPendingPipeline] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<BulkKind | null>(null);
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [confirmEligible, setConfirmEligible] = useState(0);
  const [confirmSkips, setConfirmSkips] = useState<Record<string, number>>({});

  const [pipelineConfirmOpen, setPipelineConfirmOpen] = useState(false);
  const [pipelineIndices, setPipelineIndices] = useState<number[]>([]);
  const [pipelineCreditHint, setPipelineCreditHint] = useState<{ perStep: string[]; maxTotal: number }>({
    perStep: [],
    maxTotal: 0,
  });

  const resetProgress = () => {
    setProgress(null);
    setBusyKind(null);
    abortRef.current = null;
  };

  const summarizeSkips = useCallback((codes: PeopleSkipReasonCode[]) => {
    const m: Record<string, number> = {};
    for (const c of codes) m[c] = (m[c] || 0) + 1;
    return m;
  }, []);

  const computeIndices = useCallback(
    (kind: BulkKind, indices: number[]) => {
      const snapshot = resultsRef.current;
      const eligible: number[] = [];
      const skipCodes: PeopleSkipReasonCode[] = [];
      for (const i of indices) {
        const row = snapshot[i];
        if (!row) continue;
        const s = derivePeopleRowSignals(row);
        if (kind === 'resolve') {
          const pre = resolveDomainPrecheck(row, s);
          if (pre) {
            skipCodes.push(pre);
            continue;
          }
          eligible.push(i);
          continue;
        }
        if (kind === 'industry') {
          const pre = industryEnrichPrecheck(s);
          if (pre) {
            skipCodes.push(pre);
            continue;
          }
          eligible.push(i);
          continue;
        }
        const pre = contactEnrichPrecheck(s);
        if (pre) {
          skipCodes.push(pre);
          continue;
        }
        if (kind === 'email' || kind === 'phone') {
          const wf = waterfallPersonPrecheck(s);
          if (wf) {
            skipCodes.push(wf);
            continue;
          }
        }
        eligible.push(i);
      }
      return { eligible, skipSummary: summarizeSkips(skipCodes) };
    },
    [summarizeSkips],
  );

  const openAction = (kind: BulkKind) => {
    if (busyKind) return;
    if (selectedRows.size === 0) {
      setPendingKind(kind);
      setPickScopeOpen(true);
      return;
    }
    const indices = [...selectedRows].sort((a, b) => a - b);
    openConfirm(kind, indices);
  };

  const openConfirm = (kind: BulkKind, indices: number[]) => {
    const { eligible, skipSummary } = computeIndices(kind, indices);
    setConfirmKind(kind);
    setConfirmIndices(indices);
    setConfirmEligible(eligible.length);
    setConfirmSkips(skipSummary);
    setConfirmOpen(true);
  };

  type RunKindOptions = {
    suppressSuccessToast?: boolean;
    skipIfNoEligible?: boolean;
    holdBusy?: boolean;
    sharedSignal?: AbortSignal;
  };

  const runKind = useCallback(
    async (
      kind: BulkKind,
      indices: number[],
      opts?: RunKindOptions,
    ): Promise<{ ok: number; skipped: number; err: number } | null> => {
      const { eligible } = computeIndices(kind, indices);
      if (eligible.length === 0) {
        if (opts?.holdBusy) {
          setProgress({ cur: 0, total: 0, phase: kind });
        }
        if (!opts?.skipIfNoEligible) {
          toast.error('No rows eligible for this action (see status column for reasons).');
        }
        return { ok: 0, skipped: 0, err: 0 };
      }
      if (!canAfford('enrich', eligible.length)) {
        toast.error(`Not enough credits. Need up to ${eligible.length * CREDIT_COSTS.enrich} credits.`);
        return null;
      }

      const spent = await spendCredits('enrich', eligible.length, `people_bulk_${kind}_${eligible.length}`);
      if (!spent) {
        toast.error('Failed to charge credits');
        return null;
      }

      let ownedAbort: AbortController | null = null;
      const signal =
        opts?.sharedSignal ??
        (() => {
          ownedAbort = new AbortController();
          abortRef.current = ownedAbort;
          return ownedAbort.signal;
        })();

      if (!opts?.holdBusy) {
        setBusyKind(kind);
        onRunningChange?.(true);
      }
      setProgress({ cur: 0, total: eligible.length, phase: kind });

      let ok = 0;
      let skipped = 0;
      let err = 0;
      const metaBatch: Array<{ index: number; code: PeopleSkipReasonCode; detail?: string }> = [];
      const enrichPatches: Array<{ index: number; patch: Partial<EnrichmentRowPatch> }> = [];

      const bump = () =>
        setProgress((p) => (p ? { ...p, cur: Math.min(p.total, p.cur + 1), phase: kind } : null));

      try {
        await runPool(
          eligible,
          CONCURRENCY,
          async (index) => {
            if (signal.aborted) return;
            const row = resultsRef.current[index];
            if (!row) {
              bump();
              return;
            }
            const s = derivePeopleRowSignals(row);

            if (kind === 'resolve') {
              const pre = resolveDomainPrecheck(row, s);
              if (pre) {
                metaBatch.push({ index, code: pre });
                skipped += 1;
                bump();
                return;
              }
              const { data, error } = await invokeWaterfallEnrich(
                buildWaterfallBody(row, ['company_domain']),
                { signal, maxRetriesOn429: RETRY_429 },
              );
              if (error) {
                metaBatch.push({ index, code: 'PROVIDER_ERROR', detail: error.message });
                err += 1;
                bump();
                return;
              }
              const d = normalizeDomain(String((data?.data as Record<string, unknown> | undefined)?.domain || ''));
              if (!d) {
                metaBatch.push({ index, code: 'RESOLUTION_FAILED', detail: 'No domain in response' });
                skipped += 1;
                bump();
                return;
              }
              onPatchRows([{ index, patch: { domain: d, website: `https://${d}` } }]);
              metaBatch.push({ index, code: 'OK' });
              ok += 1;
              bump();
              return;
            }

            if (kind === 'industry') {
              const pre = industryEnrichPrecheck(s);
              if (pre) {
                metaBatch.push({ index, code: pre });
                skipped += 1;
                bump();
                return;
              }
              const { data, error } = await invokeWaterfallEnrich(
                buildWaterfallBody(row, ['industry']),
                { signal, maxRetriesOn429: RETRY_429 },
              );
              if (error) {
                metaBatch.push({ index, code: 'PROVIDER_ERROR', detail: error.message });
                err += 1;
                bump();
                return;
              }
              const enriched = (data?.data || {}) as Record<string, unknown>;
              const ind = String(enriched.industry || '').trim();
              if (!ind) {
                metaBatch.push({ index, code: 'NO_INDUSTRY_RETURNED' });
                skipped += 1;
                bump();
                return;
              }
              const patch: Partial<CompanyResult> = { industry: ind };
              const ec = enriched.employee_count;
              if (typeof ec === 'number' && ec > 0) patch.employee_count = ec;
              onPatchRows([{ index, patch }]);
              metaBatch.push({ index, code: 'OK' });
              ok += 1;
              bump();
              return;
            }

            if (kind === 'email') {
              const pre = contactEnrichPrecheck(s);
              if (pre) {
                metaBatch.push({ index, code: pre });
                skipped += 1;
                bump();
                return;
              }
              const { data, error } = await invokeWaterfallEnrich(
                buildWaterfallBody(row, ['email']),
                { signal, maxRetriesOn429: RETRY_429 },
              );
              if (error) {
                metaBatch.push({ index, code: 'PROVIDER_ERROR', detail: error.message });
                err += 1;
                bump();
                return;
              }
              const enriched = (data?.data || {}) as Record<string, unknown>;
              const email = String(enriched.email || '').trim();
              if (!email) {
                metaBatch.push({ index, code: 'NO_EMAIL_RETURNED' });
                skipped += 1;
                bump();
                return;
              }
              onPatchRows([{ index, patch: { email, ...personPatchFromEnriched(enriched) } }]);
              enrichPatches.push({ index, patch: { email } });
              metaBatch.push({ index, code: 'OK' });
              ok += 1;
              bump();
              return;
            }

            if (kind === 'phone') {
              const pre = contactEnrichPrecheck(s);
              if (pre) {
                metaBatch.push({ index, code: pre });
                skipped += 1;
                bump();
                return;
              }
              const { data, error } = await invokeWaterfallEnrich(
                buildWaterfallBody(row, ['phone']),
                { signal, maxRetriesOn429: RETRY_429 },
              );
              if (error) {
                metaBatch.push({ index, code: 'PROVIDER_ERROR', detail: error.message });
                err += 1;
                bump();
                return;
              }
              const enriched = (data?.data || {}) as Record<string, unknown>;
              const phone = String(enriched.phone || '').trim();
              const mobile = String(enriched.mobile_phone || '').trim();
              if (!phone && !mobile) {
                metaBatch.push({ index, code: 'NO_PHONE_RETURNED' });
                skipped += 1;
                bump();
                return;
              }
              onPatchRows([
                {
                  index,
                  patch: {
                    phone: phone || mobile || row.phone,
                    mobile_phone: mobile || undefined,
                    ...personPatchFromEnriched(enriched),
                  },
                },
              ]);
              enrichPatches.push({
                index,
                patch: {
                  phone: phone || mobile || undefined,
                },
              });
              metaBatch.push({ index, code: 'OK' });
              ok += 1;
              bump();
              return;
            }
          },
          signal,
        );

        if (enrichPatches.length) onMergeEnrichment(enrichPatches);
        if (metaBatch.length) onRowMetaBatch(metaBatch);

        if (!opts?.suppressSuccessToast) {
          toast.success(`Done: ${ok} updated · ${skipped} skipped · ${err} error(s).`);
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          if (!opts?.holdBusy) toast.message('Cancelled');
        } else {
          toast.error(e instanceof Error ? e.message : 'Bulk enrich failed');
        }
      } finally {
        if (!opts?.holdBusy) {
          resetProgress();
          onRunningChange?.(false);
          if (ownedAbort) abortRef.current = null;
        }
      }

      return { ok, skipped, err };
    },
    [canAfford, computeIndices, onMergeEnrichment, onPatchRows, onRowMetaBatch, onRunningChange, spendCredits],
  );

  const openPipelineConfirm = useCallback(
    (indices: number[]) => {
      const perStep: string[] = [];
      let maxTotal = 0;
      for (const k of PIPELINE_STEPS) {
        const n = computeIndices(k, indices).eligible.length;
        perStep.push(`${k}: ${n} eligible`);
        maxTotal += n * CREDIT_COSTS.enrich;
      }
      setPipelineCreditHint({ perStep, maxTotal });
      setPipelineIndices(indices);
      setPipelineConfirmOpen(true);
    },
    [computeIndices],
  );

  const runPipeline = useCallback(
    async (indices: number[]) => {
      const ac = new AbortController();
      abortRef.current = ac;
      setBusyKind('pipeline');
      onRunningChange?.(true);
      let totOk = 0;
      let totSkipped = 0;
      let totErr = 0;
      let stoppedCredit = false;
      try {
        for (const kind of PIPELINE_STEPS) {
          if (ac.signal.aborted) break;
          const r = await runKind(kind, indices, {
            suppressSuccessToast: true,
            skipIfNoEligible: true,
            holdBusy: true,
            sharedSignal: ac.signal,
          });
          if (r === null) {
            toast.error('Pipeline stopped (credits or payment error).');
            stoppedCredit = true;
            break;
          }
          totOk += r.ok;
          totSkipped += r.skipped;
          totErr += r.err;
        }
        if (ac.signal.aborted) {
          toast.message('Pipeline cancelled');
        } else if (!stoppedCredit) {
          toast.success(`Pipeline finished: ${totOk} updates · ${totSkipped} skips · ${totErr} errors (all steps).`);
        }
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          toast.error(e instanceof Error ? e.message : 'Pipeline failed');
        }
      } finally {
        resetProgress();
        onRunningChange?.(false);
        abortRef.current = null;
      }
    },
    [onRunningChange, runKind],
  );

  const openPipelineAction = () => {
    if (busyKind) return;
    if (selectedRows.size === 0) {
      setPendingPipeline(true);
      setPickScopeOpen(true);
      return;
    }
    openPipelineConfirm([...selectedRows].sort((a, b) => a - b));
  };

  const busy = busyKind !== null;
  const phaseShort: Record<BulkKind, string> = {
    resolve: 'Resolve',
    industry: 'Industry',
    email: 'Email',
    phone: 'Phone',
  };
  const progLabel =
    progress && busyKind === 'pipeline' && progress.phase
      ? `${phaseShort[progress.phase]} ${progress.cur} / ${progress.total}`
      : progress
        ? `${progress.cur} / ${progress.total}`
        : '';

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="text-[11px] h-7 gap-1 px-2"
          disabled={busy}
          title="Runs Resolve domains, then Industry, then Email, then Phone in order. Uses checked rows, or all rows on this page if none are checked. Each step only charges rows that pass that step’s gates."
          onClick={openPipelineAction}
        >
          {busy && busyKind === 'pipeline' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
          Enrich all (pipeline)
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[11px] h-7 gap-1 px-2 border-border/60"
          disabled={busy}
          onClick={() => openAction('resolve')}
        >
          {busy && busyKind === 'resolve' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
          Resolve domains
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[11px] h-7 gap-1 px-2 border-border/60"
          disabled={busy}
          onClick={() => openAction('industry')}
        >
          {busy && busyKind === 'industry' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Factory className="h-3 w-3" />}
          Industry
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[11px] h-7 gap-1 px-2 border-border/60"
          disabled={busy}
          onClick={() => openAction('email')}
        >
          {busy && busyKind === 'email' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
          Email
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[11px] h-7 gap-1 px-2 border-border/60"
          disabled={busy}
          onClick={() => openAction('phone')}
        >
          {busy && busyKind === 'phone' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
          Phone
        </Button>
        {busy && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{progLabel}</span>
        )}
        {busy && (
          <Button type="button" variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => abortRef.current?.abort()}>
            Cancel
          </Button>
        )}
      </div>

      <AlertDialog
        open={pickScopeOpen}
        onOpenChange={(open) => {
          setPickScopeOpen(open);
          if (!open) {
            setPendingKind(null);
            setPendingPipeline(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No rows selected</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                {pendingPipeline ? (
                  <p>
                    Use all {results.length} row{results.length === 1 ? '' : 's'} on this page for the full enrich
                    pipeline (Resolve domains → Industry → Email → Phone), or select specific rows with the checkboxes.
                  </p>
                ) : (
                  <p>
                    Use all {results.length} row{results.length === 1 ? '' : 's'} on this page for{' '}
                    {pendingKind === 'resolve'
                      ? 'Resolve domains'
                      : pendingKind === 'industry'
                        ? 'Industry enrich'
                        : pendingKind === 'email'
                          ? 'Email enrich'
                          : 'Phone enrich'}
                    , or select specific rows with the checkboxes.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPickScopeOpen(false);
                if (pendingPipeline) {
                  setPendingPipeline(false);
                  openPipelineConfirm(results.map((_, i) => i));
                  return;
                }
                const k = pendingKind;
                setPendingKind(null);
                if (k) openConfirm(k, results.map((_, i) => i));
              }}
            >
              Use all on this page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pipelineConfirmOpen} onOpenChange={setPipelineConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run full enrich pipeline?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <div>
                  Runs <strong>Resolve domains</strong>, then <strong>Industry</strong>, then <strong>Email</strong>, then{' '}
                  <strong>Phone</strong> in order on the same row set. Later steps use updated domains from earlier steps.
                </div>
                <div>
                  Rows in scope: <strong>{pipelineIndices.length}</strong>.
                </div>
                <div className="text-xs space-y-0.5 font-mono">
                  {pipelineCreditHint.perStep.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                  <span>Max credits if every eligible row runs every step (actual charges are per step, per eligible row):</span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    up to {pipelineCreditHint.maxTotal} cr
                  </Badge>
                  <span>({CREDIT_COSTS.enrich} × eligible count per step)</span>
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  Bulk status icons update after each step. Preview is not saved as leads until you import.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const idx = pipelineIndices;
                setPipelineConfirmOpen(false);
                void runPipeline(idx);
              }}
            >
              Run pipeline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Run{' '}
              {confirmKind === 'resolve'
                ? 'Resolve domains'
                : confirmKind === 'industry'
                  ? 'Industry enrich'
                  : confirmKind === 'email'
                    ? 'Email enrich'
                    : 'Phone enrich'}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <div>
                  Rows in scope: <strong>{confirmIndices.length}</strong>. Eligible after gates:{' '}
                  <strong>{confirmEligible}</strong>.
                </div>
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                  <span>Estimated credits (charged only for eligible rows):</span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {confirmEligible * CREDIT_COSTS.enrich} cr
                  </Badge>
                  <span>
                    ({CREDIT_COSTS.enrich} per eligible row)
                  </span>
                </div>
                {Object.keys(confirmSkips).length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Pre-skipped in scope:{' '}
                    {Object.entries(confirmSkips)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </div>
                )}
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  Runs may take a while and depend on employer identity signals (organization name, domain, LinkedIn).
                  Preview updates stay in this table until you import — they are not saved as leads automatically.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmEligible === 0}
              onClick={() => {
                const k = confirmKind;
                const idx = confirmIndices;
                setConfirmOpen(false);
                if (k) void runKind(k, idx);
              }}
            >
              Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PeopleRowStatusIcon({
  code,
  detail,
  warnMissingLinkedin,
}: {
  code?: PeopleSkipReasonCode;
  detail?: string;
  warnMissingLinkedin?: boolean;
}) {
  const tip = code ? formatPeopleReasonTooltip(code, detail) : 'No bulk step has run on this row yet. Use the footer to run Resolve / Industry / Email / Phone or the full pipeline.';
  const warnTip = warnMissingLinkedin ? `${PEOPLE_SKIP_REASON_COPY.MISSING_LINKEDIN}` : '';
  const full = [tip, warnTip].filter(Boolean).join('\n\n');
  const aria = code ? `${code}. ${tip}` : tip;

  const wrap = (node: ReactNode, extraClass?: string) => (
    <span
      role="img"
      aria-label={aria}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-background/80 ${extraClass ?? ''}`}
      title={full}
    >
      {node}
    </span>
  );

  if (code === 'OK') {
    return wrap(<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />);
  }
  if (code) {
    return wrap(
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 shrink-0" aria-hidden />,
      warnMissingLinkedin ? 'ring-1 ring-amber-500/40' : '',
    );
  }
  return wrap(<Circle className="h-2.5 w-2.5 text-muted-foreground/60 fill-muted-foreground/40" aria-hidden />);
}
