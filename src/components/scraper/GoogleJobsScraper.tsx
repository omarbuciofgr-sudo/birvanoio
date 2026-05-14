import * as React from 'react';
import { Briefcase, ExternalLink, Loader2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { searchGoogleJobs, type GoogleJobItem } from '@/lib/api/googleJobsClient';

/** SerpApi Google Jobs `chips` segments — see https://serpapi.com/google-jobs-api */
type DatePostedFilter = 'any' | 'today' | '3days' | 'week' | 'month';

type EmploymentTypeChip = 'FULLTIME' | 'PARTTIME' | 'CONTRACTOR' | 'INTERN';

const DATE_POSTED_CHIP: Record<DatePostedFilter, string | null> = {
  any: null,
  today: 'date_posted:today',
  '3days': 'date_posted:3days',
  week: 'date_posted:week',
  month: 'date_posted:month',
};

const EMPLOYMENT_ORDER: EmploymentTypeChip[] = ['FULLTIME', 'PARTTIME', 'CONTRACTOR', 'INTERN'];

const EMPLOYMENT_LABELS: Record<EmploymentTypeChip, string> = {
  FULLTIME: 'Full-time',
  PARTTIME: 'Part-time',
  CONTRACTOR: 'Contractor',
  INTERN: 'Internship',
};

function buildChipsString(datePosted: DatePostedFilter, employmentTypes: EmploymentTypeChip[]): string | undefined {
  const parts: string[] = [];
  const d = DATE_POSTED_CHIP[datePosted];
  if (d) parts.push(d);
  const ordered = EMPLOYMENT_ORDER.filter((t) => employmentTypes.includes(t));
  for (const t of ordered) {
    parts.push(`employment_type:${t}`);
  }
  return parts.length > 0 ? parts.join(',') : undefined;
}

function buildPayload(state: {
  q: string;
  job_title: string;
  keywords: string;
  company: string;
  exclude_keywords: string;
  location: string;
  uule: string;
  google_domain: string;
  gl: string;
  hl: string;
  lrad: string;
  datePosted: DatePostedFilter;
  employmentTypes: EmploymentTypeChip[];
  remoteOnly: boolean;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const trim = (s: string) => s.trim();
  if (trim(state.q)) body.q = trim(state.q);
  if (trim(state.job_title)) body.job_title = trim(state.job_title);
  if (trim(state.keywords)) body.keywords = trim(state.keywords);
  if (trim(state.company)) body.company = trim(state.company);
  if (trim(state.exclude_keywords)) body.exclude_keywords = trim(state.exclude_keywords);
  if (trim(state.location)) body.location = trim(state.location);
  if (trim(state.uule)) body.uule = trim(state.uule);
  if (trim(state.google_domain)) body.google_domain = trim(state.google_domain);
  if (trim(state.gl)) body.gl = trim(state.gl);
  if (trim(state.hl)) body.hl = trim(state.hl);
  if (trim(state.lrad)) {
    const n = Number(state.lrad);
    body.lrad = Number.isFinite(n) ? n : state.lrad.trim();
  }
  const chips = buildChipsString(state.datePosted, state.employmentTypes);
  if (chips) body.chips = chips;
  if (state.remoteOnly) body.ltype = 1;
  return body;
}

export function GoogleJobsScraper() {
  const [q, setQ] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');
  const [keywords, setKeywords] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [excludeKeywords, setExcludeKeywords] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [uule, setUule] = React.useState('');
  const [googleDomain, setGoogleDomain] = React.useState('');
  const [gl, setGl] = React.useState('');
  const [hl, setHl] = React.useState('');
  const [lrad, setLrad] = React.useState('');
  /** Default Past week limits mixed-age listings; choose Any for SerpApi’s unconstrained date mix. */
  const [datePosted, setDatePosted] = React.useState<DatePostedFilter>('week');
  const [employmentTypes, setEmploymentTypes] = React.useState<EmploymentTypeChip[]>([]);
  const [remoteOnly, setRemoteOnly] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [rawOverride, setRawOverride] = React.useState('');

  const [jobs, setJobs] = React.useState<GoogleJobItem[]>([]);
  const [nextPageToken, setNextPageToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const runSearch = React.useCallback(
    async (mode: 'fresh' | 'next') => {
      let body: Record<string, unknown>;
      if (rawOverride.trim()) {
        try {
          body = JSON.parse(rawOverride) as Record<string, unknown>;
        } catch {
          toast.error('Advanced JSON is not valid JSON');
          return;
        }
      } else {
        body = buildPayload({
          q,
          job_title: jobTitle,
          keywords,
          company,
          exclude_keywords: excludeKeywords,
          location,
          uule,
          google_domain: googleDomain,
          gl,
          hl,
          lrad,
          datePosted,
          employmentTypes,
          remoteOnly,
        });
      }
      if (mode === 'next' && nextPageToken) {
        body.next_page_token = nextPageToken;
      }
      const setBusy = mode === 'next' ? setLoadingMore : setLoading;
      setBusy(true);
      try {
        const res = await searchGoogleJobs(body);
        if (res.error) toast.error(res.error);
        const batch = res.jobs ?? [];
        if (mode === 'next') {
          setJobs((prev) => [...prev, ...batch]);
        } else {
          setJobs(batch);
        }
        const tok = res.next_page_token ?? res.serpapi_pagination?.next_page_token ?? null;
        setNextPageToken(tok || null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Request failed');
      } finally {
        setBusy(false);
      }
    },
    [
      rawOverride,
      q,
      jobTitle,
      keywords,
      company,
      excludeKeywords,
      location,
      uule,
      googleDomain,
      gl,
      hl,
      lrad,
      datePosted,
      employmentTypes,
      remoteOnly,
      nextPageToken,
    ],
  );

  const toggleEmploymentType = React.useCallback((t: EmploymentTypeChip) => {
    setEmploymentTypes((prev) => {
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t];
      return [...next].sort((a, b) => EMPLOYMENT_ORDER.indexOf(a) - EMPLOYMENT_ORDER.indexOf(b));
    });
  }, []);

  const overrideActive = !!rawOverride.trim();

  return (
    <div className="space-y-4">
      <Card className="border-border/40 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/[0.04] to-transparent">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Job Scraper</h3>
                <p className="text-[10px] text-muted-foreground">
                  Google Jobs via SerpApi — searches use the Supabase Edge Function{' '}
                  <code className="text-[10px]">google-jobs-search</code>
                  ; the SerpApi key stays in project secrets (not in the browser). Set{' '}
                  <code className="text-[10px]">VITE_GOOGLE_JOBS_BACKEND=scraper</code> to use your Flask backend instead.
                  Filters use SerpApi’s{' '}
                  <a
                    href="https://serpapi.com/google-jobs-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    chips / ltype
                  </a>{' '}
                  parameters (same values sent on each page when you use Next page).
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-3">
              <p className="text-[10px] text-muted-foreground leading-snug">
                Narrow results by date posted, employment type, and remote work. These map to SerpApi <code className="text-[10px]">chips</code> (comma-separated)
                and <code className="text-[10px]">ltype=1</code> for remote.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date posted</Label>
                  <Select value={datePosted} onValueChange={(v) => setDatePosted(v as DatePostedFilter)} disabled={overrideActive}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Date posted" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="3days">Last 3 days</SelectItem>
                      <SelectItem value="week">Past week</SelectItem>
                      <SelectItem value="month">Past month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-between gap-3 sm:col-span-1">
                  <div className="space-y-1.5 flex-1">
                    <Label htmlFor="gj-remote" className="text-xs">
                      Remote only
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Sends ltype=1</p>
                  </div>
                  <Switch id="gj-remote" checked={remoteOnly} onCheckedChange={setRemoteOnly} disabled={overrideActive} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Employment type (optional)</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {EMPLOYMENT_ORDER.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <Checkbox
                        checked={employmentTypes.includes(t)}
                        onCheckedChange={() => toggleEmploymentType(t)}
                        disabled={overrideActive}
                      />
                      {EMPLOYMENT_LABELS[t]}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Query (q)</Label>
                <Input
                  placeholder="e.g. software engineer remote"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-9 text-sm"
                  disabled={overrideActive}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job title</Label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="h-9 text-sm"
                  disabled={overrideActive}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Keywords</Label>
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="h-9 text-sm"
                  disabled={overrideActive}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company</Label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="h-9 text-sm"
                  disabled={overrideActive}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exclude keywords (space-separated)</Label>
                <Input
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  className="h-9 text-sm"
                  disabled={overrideActive}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input
                  placeholder="Ignored when uule is set"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-9 text-sm"
                  disabled={overrideActive}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">uule (encoded location)</Label>
                <Input
                  value={uule}
                  onChange={(e) => setUule(e.target.value)}
                  className="h-9 text-sm font-mono text-[11px]"
                  disabled={overrideActive}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {advancedOpen ? 'Hide' : 'Show'} localization & raw JSON
            </button>

            {advancedOpen && (
              <div className="space-y-3 pt-1 border-t border-border/40">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">google_domain</Label>
                    <Input value={googleDomain} onChange={(e) => setGoogleDomain(e.target.value)} className="h-9 text-sm" placeholder="google.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">gl</Label>
                    <Input value={gl} onChange={(e) => setGl(e.target.value)} className="h-9 text-sm" placeholder="us" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">hl</Label>
                    <Input value={hl} onChange={(e) => setHl(e.target.value)} className="h-9 text-sm" placeholder="en" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">lrad (km)</Label>
                    <Input value={lrad} onChange={(e) => setLrad(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Raw body JSON (overrides form when non-empty)</Label>
                  <Textarea
                    value={rawOverride}
                    onChange={(e) => setRawOverride(e.target.value)}
                    placeholder='{"q":"nurse","location":"Austin, TX"}'
                    className="font-mono text-[11px] min-h-[88px]"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="h-9 gap-2" onClick={() => void runSearch('fresh')} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Search
              </Button>
              {nextPageToken ? (
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => void runSearch('next')} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Next page
                </Button>
              ) : null}
            </div>
          </CardContent>
        </div>
      </Card>

      {jobs.length > 0 && (
        <Card className="border-border/40">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
            <h3 className="text-sm font-semibold">{jobs.length} jobs</h3>
            {nextPageToken ? (
              <Badge variant="secondary" className="text-[10px] font-normal">
                More pages available
              </Badge>
            ) : null}
          </div>
          <CardContent className="p-0">
            <ScrollArea className="h-[min(560px,70vh)]">
              <ul className="divide-y divide-border/40">
                {jobs.map((job, i) => (
                  <li key={job.job_id ?? `${job.company_name}-${job.title}-${i}`} className="px-5 py-4 hover:bg-muted/20">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                        <span className="text-sm font-semibold">{job.title ?? '—'}</span>
                        {job.company_name ? (
                          <span className="text-xs text-muted-foreground">{job.company_name}</span>
                        ) : null}
                      </div>
                      {job.location ? <p className="text-[11px] text-muted-foreground">{job.location}</p> : null}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {job.detected_extensions?.posted_at ? (
                          <Badge variant="outline" className="text-[10px] h-5 font-normal">
                            {job.detected_extensions.posted_at}
                          </Badge>
                        ) : null}
                        {job.detected_extensions?.schedule_type ? (
                          <Badge variant="outline" className="text-[10px] h-5 font-normal">
                            {job.detected_extensions.schedule_type}
                          </Badge>
                        ) : null}
                      </div>
                      {job.description ? (
                        <p className="text-[11px] text-muted-foreground line-clamp-3 mt-2">{job.description}</p>
                      ) : null}
                      {job.apply_options && job.apply_options.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {job.apply_options.slice(0, 4).map((opt, j) =>
                            opt.link ? (
                              <a
                                key={j}
                                href={opt.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                              >
                                {opt.title ?? 'Apply'} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null,
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
