import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ListingLinkButton } from "@/components/rentcast/ListingLinkButton";
import { listingLink } from "@/lib/listingLink";
import { OwnerFlagBadges } from "@/components/rentcast/OwnerFlagBadges";
import { ListMapToggle, useListMapLayout } from "@/components/maps/ListMapToggle";
import { lazy, Suspense, type ComponentProps } from "react";
const OwnerMapLazy = lazy(() => import("@/components/maps/OwnerMap"));
const OwnerMap = (p: ComponentProps<typeof OwnerMapLazy>) => (
  <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-lg bg-muted" />}><OwnerMapLazy {...p} /></Suspense>
);
import { computeFlags, estimateFor, loadCachedEstimates, ownerRef, type PropertyEstimate } from "@/lib/ownerFlags";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CityAutocomplete } from "@/components/onboarding/CityAutocomplete";
import { SavedSearchAlerts, createAlert, useSavedAlerts } from "@/components/rentcast/SavedSearchAlerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
  ChevronDown,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import {
  rentcastApi,
  type RentCastDiagnostic,
  type RentCastListing,
  type RentCastStats,
  type ZillowSearchStats,
} from "@/lib/api/rentcastApi";
import { scraperBackendApi } from "@/lib/api/scraperBackend";
import { supabase } from "@/integrations/supabase/client";
import {
  buildLeadFromRentCast,
  hasContactInfo,
  listingExternalLinks,
  normalizeAddressKey,
} from "@/lib/rentcast/mapRentCastToLead";
import { downloadDiagnosticPdf } from "@/lib/rentcast/downloadDiagnosticPdf";
import {
  CALIBRATION_LABELS,
  downloadCalibrationCsv,
} from "@/lib/rentcast/downloadCalibrationCsv";
import { CREDIT_COSTS, useCredits } from "@/hooks/useCredits";

type FilterTab = "sale-strong" | "sale-possible" | "rental-strong" | "rental-possible";
type SourceMode = "zillow" | "rentcast";
type ListingType = "both" | "sale" | "rental";
type ConfidenceFilter = "qualified" | "likely" | "high" | "all";
type MarketStatusFilter = "active" | "inactive" | "all";
type ResultView = "best" | "all";

const SAFE_RESULTS_ERROR = "We couldn't load your results. Please try again in a minute.";

function reportAdminError(context: string, error: unknown) {
  console.error(`[Find Owners] ${context}`, error);
}

function resultCategory(row: RentCastListing): FilterTab {
  const sale = row.listing_kind === "sale";
  const text = `${row.classification || ""} ${row.qualification || ""}`.toLowerCase();
  const strong = text.includes("likely") || text.includes("strong") || rowScore(row) >= 70;
  return `${sale ? "sale" : "rental"}-${strong ? "strong" : "possible"}` as FilterTab;
}

function formatListedDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

type RentCastListingsContentProps = {
  /** When true, omit standalone page title (used inside Brivano Scout shell). */
  embedded?: boolean;
};

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function MarketStatusBadge({ status }: { status?: string | null }) {
  const s = (status || "").toLowerCase();
  if (s === "off_market") {
    return (
      <Badge variant="outline" className="border-slate-500 text-slate-300">
        OFF MARKET
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-700/80 hover:bg-emerald-700/80 text-[10px]">
      ON MARKET
    </Badge>
  );
}

function FreshnessBadge({ freshness }: { freshness?: string | null }) {
  const f = (freshness || "").toLowerCase();
  if (!f) return null;
  if (f === "fresh") {
    return <span className="text-[10px] text-emerald-500">Fresh</span>;
  }
  if (f === "aging") {
    return <span className="text-[10px] text-amber-500">Aging</span>;
  }
  if (f === "stale_risk") {
    return <span className="text-[10px] text-rose-400">Stale Risk</span>;
  }
  return <span className="text-[10px] text-muted-foreground">{freshness}</span>;
}

/**
 * Customer-facing label from the source, never from the score.
 * Zillow rows carry the final label in `classification` (set at ingest and after enrichment).
 * Legacy RentCast rows are still score-based, so they read as unverified candidates.
 */
const LEGACY_PM = new Set(["Institutional/PM", "Professionally Listed"]);
function customerLabel(row: RentCastListing): string {
  if (row.source === "zillow_serpapi") {
    return row.classification || (row.listing_kind === "sale" ? "Selling – strong match" : "Renting – strong match");
  }
  if (row.classification && LEGACY_PM.has(row.classification)) return "Professionally Managed";
  if (row.qualification === "agent_listed") return "Agent listed";
  return "Unverified Candidate";
}

function LabelBadge({ row }: { row: RentCastListing }) {
  const label = customerLabel(row);
  const cls =
    label === "Professionally Managed" || label === "Agent listed"
      ? "bg-slate-500 hover:bg-slate-500"
      : label === "Unable to Verify"
        ? "bg-rose-600 hover:bg-rose-600"
        : label === "Unverified Candidate"
          ? "bg-amber-600 hover:bg-amber-600"
          : "bg-sky-600 hover:bg-sky-600";
  return (
    <Badge className={cls}>
      {label}
    </Badge>
  );
}

function rowScore(row: RentCastListing): number {
  return Number(row.confidence_score ?? row.fsbo_confidence ?? 0);
}

function parseReasonCodes(raw: RentCastListing["reason_codes"]): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : raw.split(",").map((s) => s.trim()).filter(Boolean);
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function ownerMatchLabel(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "verified":
      return "Verified";
    case "probable":
      return "Probable";
    case "missing":
      return "Missing";
    case "pending":
      return "Pending";
    default:
      return status || "—";
  }
}

function contactStatusLabel(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "phone_email":
      return "Phone + Email";
    case "phone_only":
      return "Phone only";
    case "email_only":
      return "Email only";
    case "mailing_only":
      return "Mailing only";
    case "none":
      return "Needs enrichment";
    case "pending":
      return "Pending";
    default:
      return status || "—";
  }
}

function verificationLabel(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "confirmed_frbo":
      return "Verified FRBO";
    case "confirmed_fsbo":
      return "Verified FSBO";
    case "match_owner_unknown":
      return "Match · owner unknown";
    case "agent_listed":
      return "Agent listed (ext)";
    case "conflicting":
      return "Conflicting";
    case "no_match":
      return "No external match";
    case "not_checked":
      return "Not checked";
    default:
      return status ? `Verify: ${status}` : "Not checked";
  }
}

function bestEvidenceUrl(row: RentCastListing): string | null {
  const detail = row.external_verification_detail;
  if (!detail || typeof detail !== "object") return null;
  const direct = (detail as { best_direct_url?: string }).best_direct_url;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const evidence = (detail as { evidence?: Array<{ url?: string }> }).evidence;
  if (Array.isArray(evidence)) {
    for (const e of evidence) {
      if (e?.url?.trim()) return e.url.trim();
    }
  }
  return null;
}

function marketConflictWarning(row: RentCastListing): string | null {
  const detail = row.external_verification_detail;
  if (!detail || typeof detail !== "object") return null;
  const w = (detail as { market_status_conflict?: string | null }).market_status_conflict;
  return typeof w === "string" && w.trim() ? w.trim() : null;
}

function OwnerStatusBadges({ row }: { row: RentCastListing }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <Badge variant="outline" className="text-[10px] font-normal">
        Owner: {ownerMatchLabel(row.owner_match_status)}
      </Badge>
      <Badge variant="outline" className="text-[10px] font-normal">
        {contactStatusLabel(row.contact_status)}
      </Badge>
      {row.source === "zillow_serpapi" ? (
        <Badge variant="outline" className="text-[10px] font-normal">
          Enrichment: {row.enriched_at ? "Done" : "Pending"}
        </Badge>
      ) : null}
      {row.needs_ownership_fallback ? (
        <Badge variant="outline" className="text-[10px] font-normal">
          Ownership fallback
        </Badge>
      ) : null}
      <Badge variant="outline" className="text-[10px] font-normal">
        {verificationLabel(row.external_verification_status)}
      </Badge>
    </div>
  );
}

function mergeListings(
  current: RentCastListing[],
  updates: RentCastListing[],
): RentCastListing[] {
  if (!updates.length) return current;
  const byId = new Map(updates.map((r) => [r.rentcast_id, r]));
  return current.map((row) => {
    const id = row.rentcast_id;
    if (id && byId.has(id)) return { ...row, ...byId.get(id)! };
    return row;
  });
}

export default function RentCastListingsContent({
  embedded = false,
}: RentCastListingsContentProps) {
  const [location, setLocation] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [welcomeCity, setWelcomeCity] = useState<string | null>(null);
  const welcomeStarted = useRef(false);
  const savedAlerts = useSavedAlerts();
  const [savingAlert, setSavingAlert] = useState(false);
  const [source] = useState<SourceMode>("zillow");
  const [listingType, setListingType] = useState<ListingType>("both");
  const [zillowStats, setZillowStats] = useState<ZillowSearchStats | null>(null);
  /** Rows stored in the DB for the current location/type, from the last Load saved */
  const [storedTotal, setStoredTotal] = useState<number | null>(null);
  const [limit, setLimit] = useState("50");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("qualified");
  const [diagnosticMode, setDiagnosticMode] = useState(false);
  const [diagnostic, setDiagnostic] = useState<RentCastDiagnostic | null>(null);
  const [poolStats, setPoolStats] = useState<RentCastStats | null>(null);
  const [maxFetch, setMaxFetch] = useState<number | null>(null);
  const [maxScan, setMaxScan] = useState<string>("500");
  const [marketStatus, setMarketStatus] = useState<MarketStatusFilter>("active");
  // Production: Diagnostic / Export stay hidden. Verify is health-gated (Phase E).
  const showOpsUi = false;
  const [verifyEnabled, setVerifyEnabled] = useState(false);
  const [marketTotal, setMarketTotal] = useState<number | null>(null);
  const [pagesFetched, setPagesFetched] = useState<number | null>(null);
  const [queryType, setQueryType] = useState<string | null>(null);
  const [endpointsCalled, setEndpointsCalled] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterTab>("sale-strong");
  const [resultView, setResultView] = useState<ResultView>("best");
  const [listings, setListings] = useState<RentCastListing[]>([]);
  const [stats, setStats] = useState<RentCastStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<RentCastListing | null>(null);
  const [layout, setLayout] = useListMapLayout("find-owners");
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Map<string, PropertyEstimate>>(new Map());
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [busy, setBusy] = useState<
    "search" | "load" | "enrich" | "verify" | "import" | null
  >(null);
  const { canAfford, spendCredits } = useCredits();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await rentcastApi.health();
        if (!cancelled) {
          setVerifyEnabled(Boolean(h?.marketplace_verify_configured));
        }
      } catch {
        if (!cancelled) setVerifyEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-fill the city with the user's home market; on the welcome visit, run the free first search.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      const [{ data: profile }, { data: grant }] = await Promise.all([
        supabase.from("profiles").select("home_market").eq("user_id", auth.user.id).maybeSingle(),
        (supabase as any).from("free_search_grants").select("user_id").eq("user_id", auth.user.id).maybeSingle(),
      ]);
      const market = (profile as { home_market?: string | null } | null)?.home_market?.trim();
      if (cancelled || !market) return;
      setLocation((cur) => cur || market);
      if (searchParams.get("welcome") === "1" && !grant && !welcomeStarted.current) {
        welcomeStarted.current = true;
        const next = new URLSearchParams(searchParams);
        next.delete("welcome");
        setSearchParams(next, { replace: true });
        const found = await onSearch(market, { firstFree: true });
        if (found && !cancelled) setWelcomeCity(market.split(",")[0].trim());
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open an owner straight from an alert email link.
  useEffect(() => {
    const listingId = searchParams.get("listing");
    if (!listingId) return;
    navigate(`/dashboard/owners/${encodeURIComponent(listingId)}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveAlert = async () => {
    const loc = location.trim();
    if (!loc) {
      toast.error("Enter a city and state first.");
      return;
    }
    setSavingAlert(true);
    const { error } = await createAlert(loc, listingType, resultView === "best" ? "best" : "all");
    setSavingAlert(false);
    if (error) {
      toast.error(error, error.includes("Upgrade") ? { action: { label: "Upgrade", onClick: () => (window.location.href = "/dashboard/billing") } } : undefined);
      return;
    }
    toast.success(`Daily alerts on for ${loc}. We'll email you at 7am when new owners appear.`);
    savedAlerts.refresh();
  };

  // Flags use estimates already cached on the server; no provider calls from the table.
  useEffect(() => {
    if (!listings.length) return;
    let cancelled = false;
    loadCachedEstimates(listings).then((m) => !cancelled && setEstimates(m)).catch(() => {});
    return () => { cancelled = true; };
  }, [listings]);

  const flagsFor = (row: RentCastListing) => computeFlags(row, estimateFor(estimates, row));

  const filtered = useMemo(() => {
    return listings.filter((row) => {
      if (resultView === "best" && rowScore(row) < 60) return false;
      if (flaggedOnly && computeFlags(row, estimateFor(estimates, row)).length === 0) return false;
      return resultCategory(row) === filter;
    });
  }, [listings, filter, resultView, flaggedOnly, estimates]);

  const openOwner = async (row: RentCastListing) => {
    await saveSearchResults([row], row.search_location || location.trim() || "");
    navigate(`/dashboard/owners/${encodeURIComponent(ownerRef(row))}`);
  };

  const likelyInView = useMemo(
    () => filtered.filter((r) => rowScore(r) >= 60),
    [filtered],
  );

  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((r) => r.rentcast_id && selectedIds.has(r.rentcast_id));

  const applyResult = (rows: RentCastListing[] | undefined, s?: RentCastStats | null) => {
    setListings(Array.isArray(rows) ? rows : []);
    if (s) setStats(s);
    setSelectedIds(new Set());
  };

  const saveSearchResults = async (rows: RentCastListing[], searchLocation: string) => {
    if (!rows.length) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const payload = rows
      .filter((row) => row.rentcast_id || row.address)
      .map((row) => ({
        user_id: auth.user!.id,
        external_id: row.rentcast_id || normalizeAddressKey(row.address),
        search_location: searchLocation,
        listing_kind: row.listing_kind || null,
        listing_data: row,
      }));
    if (!payload.length) return;
    const { error } = await (supabase as any)
      .from("owner_search_results")
      .upsert(payload, { onConflict: "user_id,external_id" });
    if (error) reportAdminError("Unable to save search history", error);
  };

  const patchListings = (updates: RentCastListing[]) => {
    setListings((prev) => mergeListings(prev, updates));
    setDetailRow((prev) => {
      if (!prev?.rentcast_id) return prev;
      const hit = updates.find((u) => u.rentcast_id === prev.rentcast_id);
      return hit ? { ...prev, ...hit } : prev;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    const ids = filtered.map((r) => r.rentcast_id).filter(Boolean) as string[];
    setSelectedIds(new Set(ids));
  };

  const toggleSelect = (id?: string) => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyQueryMeta = (res: {
    query_type?: string;
    endpoints_called?: string[];
    diagnostic?: RentCastDiagnostic | null;
  }) => {
    setQueryType(res.query_type || res.diagnostic?.query_type || null);
    setEndpointsCalled(
      res.endpoints_called?.length
        ? res.endpoints_called
        : res.diagnostic?.endpoints_called?.length
          ? res.diagnostic.endpoints_called
          : [],
    );
  };

  const onSearch = async (
    locOverride?: string,
    opts?: { firstFree?: boolean },
  ): Promise<boolean> => {
    const loc = (locOverride ?? location).trim();
    if (!loc) {
      toast.error("Enter a city and state (e.g. Naperville, IL)");
      return false;
    }
    if (!opts?.firstFree && !canAfford("scrape")) {
      toast.error(`You need ${CREDIT_COSTS.scrape} credit to run this search.`);
      return false;
    }
    setBusy("search");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: cached } = await (supabase as any)
          .from("owner_search_results")
          .select("listing_data, listing_kind")
          .eq("user_id", auth.user.id)
          .ilike("search_location", loc)
          .gte("updated_at", cutoff)
          .order("updated_at", { ascending: false });
        const cachedRows = (cached ?? [])
          .filter((row: { listing_kind?: string }) => listingType === "both" || row.listing_kind === listingType)
          .map((row: { listing_data: RentCastListing }) => row.listing_data);
        if (cachedRows.length) {
          applyResult(cachedRows.slice(0, Math.max(1, Number(limit) || 50)));
          setStoredTotal(cachedRows.length);
          toast.success(`Loaded ${cachedRows.length} saved listings from the last 24 hours · no credit used`);
          return true;
        }
      }
      const ok = await scraperBackendApi.isScraperBackendReachable();
      if (!ok) {
        reportAdminError("Search service unreachable", new Error("Health check failed"));
        toast.error(SAFE_RESULTS_ERROR);
        return false;
      }
      if (source === "zillow") {
        const types = listingType === "both" ? (["sale", "rental"] as const) : [listingType];
        const responses = await Promise.all(
          types.map((type) => rentcastApi.zillowSearch({ location: loc, type, save: true })),
        );
        const rows = responses.flatMap((res) => res.listings || []).slice(0, Math.max(1, Number(limit) || 50));
        const failed = responses.filter((res) => !res.success && !res.listings?.length);
        if (failed.length === responses.length) {
          failed.forEach((res) => reportAdminError("Owner search failed", res.error));
          toast.error(SAFE_RESULTS_ERROR);
          applyResult([]);
          return false;
        }
        setZillowStats(responses[0]?.stats || null);
        applyResult(rows);
        setStoredTotal(rows.length);
        setQueryType(listingType);
        await saveSearchResults(rows, loc);
        await spendCredits("scrape", 1, "find-owners");
        toast.success(`Found ${rows.length} owner listings${opts?.firstFree ? " · your first search is free" : ""}`);
        return true;
      }
      setStoredTotal(null); // RentCast search results come from the API, not the DB
      const minConfidence =
        confidenceFilter === "high"
          ? 90
          : confidenceFilter === "likely"
            ? 70
            : confidenceFilter === "qualified"
              ? 60
              : 0;
      const res = await rentcastApi.search({
        location: loc,
        type: listingType,
        limit: Math.max(1, Math.min(Number(limit) || 50, 200)),
        save: true,
        likely_only: minConfidence >= 60,
        min_confidence: minConfidence,
        diagnostic: diagnosticMode,
        debug_pipeline: true,
        max_scan: Number(maxScan) || 500,
        market_status: marketStatus,
      });
      applyQueryMeta(res);
      if (!res.success && !res.listings?.length) {
        reportAdminError("Owner search failed", res.error);
        toast.error(SAFE_RESULTS_ERROR);
        applyResult([], res.stats || null);
        setDiagnostic(diagnosticMode ? res.diagnostic || null : null);
        setPoolStats(res.pool_stats || null);
        setMaxFetch(res.max_fetch ?? null);
        setMarketTotal(res.rentcast_total_count ?? res.diagnostic?.rentcast_total_count ?? null);
        setPagesFetched(res.pages_fetched ?? res.diagnostic?.pages_fetched ?? null);
        return false;
      }
      applyResult(res.listings, res.stats || null);
      await saveSearchResults(res.listings || [], loc);
      await spendCredits("scrape", 1, "find-owners");
      setDiagnostic(diagnosticMode ? res.diagnostic || null : null);
      setPoolStats(res.pool_stats || null);
      setMaxFetch(res.max_fetch ?? null);
      setMarketTotal(res.rentcast_total_count ?? res.diagnostic?.rentcast_total_count ?? null);
      setPagesFetched(res.pages_fetched ?? res.diagnostic?.pages_fetched ?? null);
      const st = res.stats;
      const diag = res.diagnostic;
      const src =
        res.endpoints_called?.length
          ? ` · ${res.query_type || listingType}: ${res.endpoints_called.join(", ")}`
          : "";
      const poolQualified =
        (res.pool_stats?.qualified_60_plus ?? 0) ||
        (res.pool_stats?.likely_frbo ?? 0) +
          (res.pool_stats?.likely_fsbo ?? 0) +
          (res.pool_stats?.frbo_candidate ?? 0) +
          (res.pool_stats?.fsbo_candidate ?? 0);
      const ol = res.owner_lookup;
      const ownerNote = ol?.attempted
        ? ` · owners ${ol.success ?? 0}/${ol.attempted}${ol.capped ? " (budget cap)" : ""}`
        : "";
      toast.success(
        `Found ${st?.total ?? res.listings?.length ?? 0} listings` +
          (res.saved != null ? ` · saved ${res.saved}` : "") +
          ownerNote +
          (st
            ? ` · Likely FRBO ${st.likely_frbo ?? 0} · Candidate FRBO ${st.frbo_candidate ?? 0} · Likely FSBO ${st.likely_fsbo ?? 0} · Candidate FSBO ${st.fsbo_candidate ?? 0}`
            : "") +
          (diag || res.pool_stats
            ? ` · scanned ${diag?.total_scored ?? res.pool_stats?.total ?? "—"} · max score ${diag?.highest_score ?? "—"} · pool 60+ ${poolQualified}`
            : "") +
          src,
      );
      if (res.error) reportAdminError("Owner search warning", res.error);
      return true;
    } catch (e: unknown) {
      reportAdminError("Owner search exception", e);
      toast.error(SAFE_RESULTS_ERROR);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const onLoadSaved = async () => {
    setBusy("load");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");
      let query = (supabase as any)
        .from("owner_search_results")
        .select("listing_data")
        .eq("user_id", auth.user.id)
        .order("updated_at", { ascending: false })
        .limit(500);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []).map((record: { listing_data: RentCastListing }) => record.listing_data);
      applyResult(rows);
      setStoredTotal(rows.length);
      toast.success(`Loaded ${rows.length} saved results`);
    } catch (e: unknown) {
      reportAdminError("Saved searches failed", e);
      toast.error(SAFE_RESULTS_ERROR);
    } finally {
      setBusy(null);
    }
  };

  const runEnrich = async (ids?: string[]) => {
    const count = ids?.length || Math.max(likelyInView.length, 10);
    if (!canAfford("enrich", count)) {
      toast.error(`You need ${count * CREDIT_COSTS.enrich} credits to get this contact info.`);
      return;
    }
    setBusy("enrich");
    try {
      const res = await rentcastApi.enrich({
        location: ids?.length ? undefined : location.trim() || undefined,
        rentcast_ids: ids?.length ? ids : undefined,
        limit: ids?.length ? ids.length : Math.max(likelyInView.length, 10),
        likely_only: !ids?.length,
      });
      if (!res.success) {
        reportAdminError("Contact enrichment failed", res.error);
        toast.error(SAFE_RESULTS_ERROR);
        return;
      }
      const summary = res.summary;
      if (summary) {
        const skipped = summary.skipped_below_60
          ? ` · skipped <60: ${summary.skipped_below_60}`
          : "";
        toast.success(
          `Enrich done: ${summary.enriched ?? 0} with contact · ${summary.partial ?? 0} partial · ${summary.no_contact ?? 0} no contact · ${summary.failed ?? 0} failed${skipped}`,
        );
      } else {
        toast.success(`Processed ${res.total ?? res.results?.length ?? 0} rows`);
      }
      if (res.listings?.length) {
        patchListings(res.listings);
      } else {
        await onLoadSaved();
      }
    } catch (e: unknown) {
      reportAdminError("Contact enrichment exception", e);
      toast.error(SAFE_RESULTS_ERROR);
    } finally {
      setBusy(null);
    }
  };

  const onEnrichSelected = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select at least one row to enrich");
      return;
    }
    return runEnrich(ids);
  };

  const onEnrichAllLikely = () => {
    const ids = likelyInView.map((r) => r.rentcast_id).filter(Boolean) as string[];
    if (!ids.length) {
      toast.error("No likely FSBO/FRBO rows in the current view");
      return;
    }
    return runEnrich(ids);
  };

  const runVerify = async (ids?: string[]) => {
    setBusy("verify");
    try {
      const res = await rentcastApi.verify({
        location: ids?.length ? undefined : location.trim() || undefined,
        rentcast_ids: ids?.length ? ids : undefined,
        limit: ids?.length ? Math.min(ids.length, 25) : Math.min(likelyInView.length || 20, 20),
        likely_only: !ids?.length,
        min_score: 60,
      });
      if (!res.success) {
        toast.error(res.error || "Verification failed");
        return;
      }
      const s = res.summary;
      if (s) {
        toast.success(
          `Verify: FRBO ${s.confirmed_frbo ?? 0} · FSBO ${s.confirmed_fsbo ?? 0} · unknown ${s.match_owner_unknown ?? 0} · agent ${s.agent_listed ?? 0} · conflict ${s.conflicting ?? 0} · no match ${s.no_match ?? 0} · not checked ${s.not_checked ?? 0}` +
            (s.configured === false ? " (provider not configured)" : ""),
        );
      } else {
        toast.success(`Verified ${res.total ?? res.results?.length ?? 0} rows`);
      }
      if (res.listings?.length) {
        patchListings(res.listings);
      }
    } catch (e: unknown) {
      reportAdminError("Listing verification failed", e);
      toast.error(SAFE_RESULTS_ERROR);
    } finally {
      setBusy(null);
    }
  };

  const onVerifySelected = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select at least one row to verify");
      return;
    }
    return runVerify(ids);
  };

  const onVerifyTopLikely = () => {
    const ids = likelyInView
      .slice(0, 20)
      .map((r) => r.rentcast_id)
      .filter(Boolean) as string[];
    if (!ids.length) {
      toast.error("No likely FSBO/FRBO rows in the current view");
      return;
    }
    return runVerify(ids);
  };

  const importRowsToCrm = async (rows: RentCastListing[]) => {
    if (!rows.length) return;
    setBusy("import");
    try {
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !userData.user) throw new Error("Not authenticated");

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of rows) {
        if (!row.address?.trim()) {
          skipped += 1;
          continue;
        }
        if (!hasContactInfo(row)) {
          toast.message(`Importing ${row.address} without phone/email — enrich recommended`);
        }

        const payload = buildLeadFromRentCast(row, userData.user.id);
        void normalizeAddressKey(row.address);

        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("client_id", userData.user.id)
          .ilike("business_name", row.address.trim())
          .maybeSingle();

        let leadId: string | null = existing?.id ?? null;

        if (existing?.id) {
          const { error } = await supabase
            .from("leads")
            .update({
              contact_name: payload.contact_name,
              email: payload.email,
              phone: payload.phone,
              city: payload.city,
              state: payload.state,
              zip_code: payload.zip_code,
              source_url: payload.source_url,
              lead_score: payload.lead_score,
              notes: payload.notes,
              industry: payload.industry,
            })
            .eq("id", existing.id);
          if (error) throw error;
          updated += 1;
          leadId = existing.id;
        } else {
          const { data: inserted, error } = await supabase
            .from("leads")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          created += 1;
          leadId = inserted?.id ?? null;
        }

        if (leadId && row.rentcast_id) {
          try {
            await (supabase as any)
              .from("rentcast_listings")
              .update({ imported_lead_id: leadId })
              .eq("rentcast_id", row.rentcast_id);
          } catch {
            /* listing table optional */
          }
          patchListings([{ ...row, imported_lead_id: leadId }]);
        }
      }

      toast.success(`CRM: ${created} created · ${updated} updated · ${skipped} skipped`);
    } catch (e: unknown) {
      reportAdminError("Lead save failed", e);
      toast.error("We couldn't save these leads. Please try again in a minute.");
    } finally {
      setBusy(null);
    }
  };

  const onImportSelected = () => {
    const rows = filtered.filter(
      (r) => r.rentcast_id && selectedIds.has(r.rentcast_id),
    );
    if (!rows.length) {
      toast.error("Select at least one row to import");
      return;
    }
    return importRowsToCrm(rows);
  };

  const onImportOne = (row: RentCastListing) => importRowsToCrm([row]);

  const selectedCount = selectedIds.size;
  const likelyCount = likelyInView.length;

  const onExportLabelsCsv = () => {
    try {
      const selected = filtered.filter(
        (r) => r.rentcast_id && selectedIds.has(r.rentcast_id),
      );
      // Prefer selection → Likely in view → all visible (for All scored calibration mix)
      const rows =
        selected.length > 0
          ? selected
          : likelyInView.length > 0
            ? likelyInView
            : filtered;
      const n = downloadCalibrationCsv({
        rows,
        location: location.trim() || "rentcast",
      });
      toast.success(
        `Exported ${n} row(s). Fill human_label: ${CALIBRATION_LABELS.join(" | ")}`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "CSV export failed");
    }
  };

  return (
    <>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Find Owners</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search any US city to find homeowners selling or renting their property without an agent.
          </p>
        </div>

        <SavedSearchAlerts alerts={savedAlerts.alerts} loading={savedAlerts.loading} refresh={savedAlerts.refresh} />

        {welcomeCity && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <p>Here are owners in {welcomeCity} selling or renting on their own. Click any owner to see details.</p>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setWelcomeCity(null)}>Dismiss</Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/40 bg-muted/20 p-3">
          <div className="w-full space-y-1 sm:w-52">
            <label className="text-[11px] text-muted-foreground">City, State</label>
            <div onKeyDown={(e) => e.key === "Enter" && onSearch()}>
              <CityAutocomplete value={location} onChange={setLocation} />
            </div>
          </div>
          <div className="w-full space-y-1 sm:w-36">
            <label className="text-[11px] text-muted-foreground">Looking for</label>
            <Select value={listingType} onValueChange={(v) => setListingType(v as ListingType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Selling</SelectItem>
                <SelectItem value="rental">Renting</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1 sm:w-24">
            <label className="text-[11px] text-muted-foreground">Number of results</label>
            <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" />
          </div>
          <div className="w-full space-y-1 sm:w-40">
            <label className="text-[11px] text-muted-foreground">Show</label>
            <Select value={resultView} onValueChange={(v) => setResultView(v as ResultView)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Best matches</SelectItem>
                <SelectItem value="all">All results</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Collapsible className="w-full">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 px-0 text-muted-foreground">
                Advanced options <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-wrap gap-2 pt-2">
          <div className="w-full space-y-1 sm:w-36">
            <label className="text-[11px] text-muted-foreground">Market</label>
            <Select
              value={marketStatus}
              onValueChange={(v) => setMarketStatus(v as MarketStatusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">On Market</SelectItem>
                <SelectItem value="inactive">Off Market</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1 sm:w-36">
            <label className="text-[11px] text-muted-foreground">Scan depth</label>
            <Select value={maxScan} onValueChange={setMaxScan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
                <SelectItem value="1500">1500</SelectItem>
                <SelectItem value="2000">2000</SelectItem>
              </SelectContent>
            </Select>
          </div>
            </CollapsibleContent>
          </Collapsible>
          {showOpsUi && (
            <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
              <Checkbox
                checked={diagnosticMode}
                onCheckedChange={(v) => setDiagnosticMode(v === true)}
              />
              Diagnostic
            </label>
          )}
          <Button onClick={() => onSearch()} disabled={!!busy} className="gap-1.5">
            {busy === "search" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Find Owners ({CREDIT_COSTS.scrape} credit)
          </Button>
          <Button variant="outline" onClick={onLoadSaved} disabled={!!busy} className="gap-1.5">
            {busy === "load" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            My past searches
          </Button>
          <Button variant="outline" onClick={onSaveAlert} disabled={!!busy || savingAlert || !location.trim()} className="gap-1.5">
            {savingAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Get daily alerts for this search
          </Button>
          <Button
            variant="secondary"
            onClick={onEnrichSelected}
            disabled={!!busy || selectedCount === 0}
            className="gap-1.5"
          >
            {busy === "enrich" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Get contact info ({selectedCount} selected · {selectedCount * CREDIT_COSTS.enrich} credits)
          </Button>
          {verifyEnabled && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="secondary"
                      onClick={onVerifySelected}
                      disabled={!!busy || selectedCount === 0}
                      className="gap-1.5"
                    >
                      {busy === "verify" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Check still listed by owner ({selectedCount})
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Rechecks the selected listings to confirm they're still active and still listed by the owner, not an agent. This does not find phone numbers or emails.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="secondary"
                      onClick={onVerifyTopLikely}
                      disabled={!!busy || likelyCount === 0}
                      className="gap-1.5"
                    >
                      Check top {Math.min(likelyCount, 20)} best matches
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Same check for your top best matches on screen, so you don't reach out about listings that sold, rented or moved to an agent.
                </TooltipContent>
              </Tooltip>
            </>
          )}
          <Button
            variant="outline"
            onClick={onImportSelected}
            disabled={!!busy || selectedCount === 0}
            className="gap-1.5"
          >
            {busy === "import" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Save to My Leads ({selectedCount})
          </Button>
          {showOpsUi && (
            <Button
              variant="outline"
              onClick={onExportLabelsCsv}
              disabled={!!busy || filtered.length === 0}
              className="gap-1.5"
              title={`Phase 6 labels: ${CALIBRATION_LABELS.join(" | ")}`}
            >
              <Download className="h-4 w-4" />
              Export labels CSV
              {selectedCount > 0
                ? ` (${selectedCount})`
                : likelyCount > 0
                  ? ` (${likelyCount} likely)`
                  : filtered.length > 0
                    ? ` (${filtered.length})`
                    : ""}
            </Button>
          )}
        </div>

        {zillowStats && source === "zillow" && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Found {zillowStats.kept ?? 0}</Badge>
            <Badge variant="outline">
              Pages {zillowStats.pages_fetched ?? 0}/{zillowStats.total_pages ?? "?"}
              {zillowStats.cached_pages ? ` (${zillowStats.cached_pages} cached, free)` : ""}
            </Badge>
            <Badge variant="outline">Out of market {zillowStats.out_of_market ?? 0}</Badge>
            <Badge variant="outline">
              Credits today {zillowStats.requests_today ?? "?"}/{zillowStats.daily_limit ?? "?"}
            </Badge>
            {zillowStats.page_cap_reached && <Badge variant="destructive">Page cap reached</Badge>}
            {zillowStats.daily_limit_reached && (
              <Badge variant="destructive">Daily limit reached</Badge>
            )}
          </div>
        )}

        {stats && source === "rentcast" && (
          <div className="flex flex-wrap gap-2 text-xs">
            {queryType && (
              <Badge variant="secondary">Query {queryType}</Badge>
            )}
            {/* Source endpoint chip hidden from production UI; still tracked in state/toast */}
            <Badge variant="outline">Total {stats.total ?? 0}</Badge>
            <Badge variant="outline">Sale {stats.sale ?? 0}</Badge>
            <Badge variant="outline">Rental {stats.rental ?? 0}</Badge>
            <Badge variant="outline">Likely FSBO {stats.likely_fsbo ?? 0}</Badge>
            <Badge variant="outline">Likely FRBO {stats.likely_frbo ?? 0}</Badge>
            <Badge variant="outline">Candidate FSBO {stats.fsbo_candidate ?? 0}</Badge>
            <Badge variant="outline">Candidate FRBO {stats.frbo_candidate ?? 0}</Badge>
            <Badge variant="outline">High {stats.high_confidence ?? 0}</Badge>
            <Badge variant="outline">Likely band {stats.likely_band ?? 0}</Badge>
            <Badge variant="outline">Candidate band {stats.candidate_band ?? 0}</Badge>
            {/* Scan pool / Market total / Pages / Pool 60+ hidden from UI; still in state/backend */}
          </div>
        )}

        {showOpsUi && diagnostic && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-sm">Diagnostic report</div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => {
                  try {
                    downloadDiagnosticPdf({
                      location: location.trim(),
                      listingType,
                      confidenceFilter,
                      limit,
                      maxFetch,
                      maxScan: Number(maxScan) || maxFetch,
                      marketTotal,
                      pagesFetched,
                      stats,
                      poolStats,
                      diagnostic,
                      calibrationRows: likelyInView.length > 0 ? likelyInView : filtered,
                    });
                    toast.success("Diagnostic PDF downloaded");
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "PDF download failed");
                  }
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            </div>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              <div>Retrieved: {diagnostic.total_rentcast_retrieved ?? "—"}</div>
              <div>Market total: {diagnostic.rentcast_total_count ?? marketTotal ?? "—"}</div>
              <div>Pages fetched: {diagnostic.pages_fetched ?? pagesFetched ?? "—"}</div>
              <div>Scan depth: {diagnostic.max_scan ?? maxScan ?? "—"}</div>
              <div>Active: {diagnostic.total_active ?? "—"}</div>
              <div>Scored: {diagnostic.total_scored ?? "—"}</div>
              <div>Apartments seen: {diagnostic.apartments_seen ?? "—"}</div>
              <div>Apartments scored: {diagnostic.apartments_scored ?? "—"}</div>
              <div>
                Apt complexes excluded:{" "}
                {diagnostic.apartments_excluded_as_complex ?? diagnostic.apartments_excluded ?? "—"}
              </div>
              <div>No MLS #: {diagnostic.no_mls_number ?? "—"}</div>
              <div>No MLS name: {diagnostic.no_mls_name ?? "—"}</div>
              <div>No meaningful agent: {diagnostic.no_meaningful_agent ?? "—"}</div>
              <div>No meaningful office: {diagnostic.no_meaningful_office ?? "—"}</div>
              <div>
                Owner lookup: {diagnostic.owner_lookup?.success ?? 0} ok /{" "}
                {diagnostic.owner_lookup?.failed ?? 0} fail /{" "}
                {diagnostic.owner_lookup?.attempted ?? 0} attempted
                {diagnostic.owner_lookup?.capped ? " (capped)" : ""}
              </div>
              <div>With owner name: {diagnostic.rows_with_owner_name ?? "—"}</div>
              <div>Individual owners: {diagnostic.individual_owners ?? "—"}</div>
              <div>Org owners: {diagnostic.organization_owners ?? "—"}</div>
              <div>OwnerOcc=false: {diagnostic.owner_occupied_false ?? "—"}</div>
              <div>PM/institutional hits: {diagnostic.pm_institutional_keyword_hits ?? "—"}</div>
              <div>Capped no owner signal: {diagnostic.capped_no_owner_signal ?? "—"}</div>
              <div>Owner match missing: {diagnostic.owner_match_missing ?? "—"}</div>
              <div>Owner match verified: {diagnostic.owner_match_verified ?? "—"}</div>
              <div>Score 20+: {diagnostic.score_20_plus ?? "—"}</div>
              <div>Score 40+: {diagnostic.score_40_plus ?? "—"}</div>
              <div>Score 50+: {diagnostic.score_50_plus ?? "—"}</div>
              <div>Score 60+: {diagnostic.score_60_plus ?? "—"}</div>
              <div>Score 70+: {diagnostic.score_70_plus ?? "—"}</div>
              <div>Highest: {diagnostic.highest_score ?? "—"}</div>
              <div>Average: {diagnostic.average_score ?? "—"}</div>
            </div>
            {diagnostic.verification && (
              <div className="text-muted-foreground">
                External verify — FRBO {diagnostic.verification.confirmed_frbo ?? 0}, FSBO{" "}
                {diagnostic.verification.confirmed_fsbo ?? 0}, unknown{" "}
                {diagnostic.verification.match_owner_unknown ?? 0}, agent{" "}
                {diagnostic.verification.agent_listed ?? 0}, no match{" "}
                {diagnostic.verification.no_match ?? 0}, not checked{" "}
                {diagnostic.verification.not_checked ?? 0}
              </div>
            )}
            {diagnostic.property_types && (
              <div className="text-muted-foreground">
                Types — SF {diagnostic.property_types.single_family ?? 0}, Condo{" "}
                {diagnostic.property_types.condo ?? 0}, TH {diagnostic.property_types.townhouse ?? 0}, MF{" "}
                {diagnostic.property_types.multi_family ?? 0}, Apt{" "}
                {diagnostic.property_types.apartment ?? 0}
              </div>
            )}
            {!!diagnostic.top_properties?.length && (
              <div className="space-y-2">
                <div className="font-medium">Top {diagnostic.top_properties.length} scores</div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {diagnostic.top_properties.map((p, idx) => (
                    <div key={`${p.address}-${idx}`} className="rounded border bg-background p-2">
                      <div className="font-medium">
                        {p.address || "—"} — Score {p.score ?? 0}
                      </div>
                      <div className="text-muted-foreground">
                        {p.listing_kind} · {p.property_type || "—"} · {p.qualification || "—"} ·{" "}
                        {p.owner_name || "Not yet identified"} · Match: {p.owner_match_status || "—"}
                      </div>
                      {!!p.score_breakdown?.length && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.score_breakdown.map((part, i) => (
                            <Badge key={`${part.code}-${i}`} variant="outline" className="font-mono">
                              {(part.points ?? 0) >= 0 ? "+" : ""}
                              {part.points ?? 0} {part.code}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(listings.length > 0 || storedTotal != null) && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {listings.length} loaded
            {storedTotal != null ? ` · ${storedTotal} stored for this search` : ""}
            {` · ${listings.filter((r) => r.listing_kind === "rental").length} rentals · ${listings.filter((r) => r.listing_kind === "sale").length} sales`}
            {` · ${listings.filter((r) => r.enriched_at).length} enriched · ${listings.filter((r) => !r.enriched_at).length} pending enrichment`}
            {storedTotal != null && storedTotal > listings.length
              ? ` · showing the newest ${listings.length}`
              : ""}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {(
              [
                ["sale-strong", "Selling – strong match"],
                ["sale-possible", "Selling – possible"],
                ["rental-strong", "Renting – strong match"],
                ["rental-possible", "Renting – possible"],
              ] as const
            ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              className="min-h-11 whitespace-normal text-xs sm:min-h-9"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
          <label className="col-span-2 flex min-h-11 items-center gap-2 text-xs text-muted-foreground cursor-pointer sm:ml-auto">
            <Checkbox className="h-6 w-6 sm:h-4 sm:w-4" checked={flaggedOnly} onCheckedChange={(v) => setFlaggedOnly(v === true)} aria-label="Show only flagged owners" />
            Flagged only (price dropped, 30+ days, above market)
          </label>
        </div>

        <ListMapToggle value={layout} onChange={setLayout} />

        {layout === "map" ? (
          <OwnerMap
            items={filtered.filter((r) => r.address).map((row) => ({
              id: row.rentcast_id || row.address!,
              address: row.address!,
              kind: row.listing_kind === "sale" ? "sale" : "rental",
              price: row.price ?? null,
              flags: flagsFor(row),
              lat: row.latitude ?? null,
              lng: row.longitude ?? null,
              extra: rowScore(row) >= 70 ? "High match" : "Medium match",
              onOpen: () => openOwner(row),
            }))}
          />
        ) : (
        <>
        <div className="hidden rounded-lg border border-border/40 overflow-hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Selling or Renting</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Date listed</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Owner &amp; contact</TableHead>
                <TableHead>Saved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                    Enter a city and click Find Owners. Most searches return results in under a minute.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const id = row.rentcast_id || row.address || "";
                  return (
                    <TableRow key={id} className="cursor-pointer" onClick={() => openOwner(row)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={!!row.rentcast_id && selectedIds.has(row.rentcast_id)}
                          onCheckedChange={() => toggleSelect(row.rentcast_id)}
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="max-w-[260px] text-sm">
                        <button
                          type="button"
                          className="text-left font-medium leading-snug hover:underline"
                          onClick={(e) => { e.stopPropagation(); openOwner(row); }}
                        >
                          {row.address || "—"}
                        </button>
                        <OwnerFlagBadges flags={flagsFor(row)} className="mt-1" />
                        <ListingLinkButton row={row} />
                        <div className="text-[11px] text-muted-foreground">
                          {[row.bedrooms != null ? `${row.bedrooms} bd` : null, row.bathrooms != null ? `${row.bathrooms} ba` : null, row.property_type]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{row.listing_kind === "sale" ? "Selling" : "Renting"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{money(row.price)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatListedDate(row.listed_date)}</TableCell>
                      <TableCell><Badge variant={rowScore(row) >= 70 ? "default" : "secondary"}>{rowScore(row) >= 70 ? "High" : "Medium"}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        <div className="truncate">{row.owner_name || "Not yet identified"}</div>
                        <div className="text-muted-foreground truncate">
                          {row.owner_phone || row.owner_email || row.owner_mailing_address || ""}
                        </div>
                        <OwnerStatusBadges row={row} />
                      </TableCell>
                      <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                        {row.imported_lead_id ? (
                          <Link
                            to="/dashboard/leads"
                            className="text-primary hover:underline"
                          >
                            Saved
                          </Link>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            disabled={!!busy}
                            onClick={() => onImportOne(row)}
                          >
                            Save
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="grid gap-3 md:hidden">
          <label className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-muted/20 px-3 text-sm">
            <Checkbox className="h-6 w-6" checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Select all owners" />
            Select all results
          </label>
          {filtered.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Enter a city and tap Find Owners. Most searches return results in under a minute.
            </div>
          ) : filtered.map((row) => {
            const id = row.rentcast_id || row.address || "";
            const selected = !!row.rentcast_id && selectedIds.has(row.rentcast_id);
            return (
              <div key={id} role="button" tabIndex={0} onClick={() => openOwner(row)} onKeyDown={(event) => { if (event.key === "Enter") openOwner(row); }} className="rounded-md border border-border bg-card p-4 text-left shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center" onClick={(event) => event.stopPropagation()}>
                    <Checkbox className="h-6 w-6" checked={selected} onCheckedChange={() => toggleSelect(row.rentcast_id)} aria-label={`Select ${row.address || "owner"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{row.address || "Unknown address"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{row.listing_kind === "sale" ? "Selling" : "Renting"}</Badge>
                      <Badge variant={rowScore(row) >= 70 ? "default" : "outline"}>{rowScore(row) >= 70 ? "High match" : "Medium match"}</Badge>
                      {row.imported_lead_id && <Badge variant="outline">Saved</Badge>}
                    </div>
                    <p className="mt-3 text-lg font-semibold">{money(row.price)}</p>
                    <OwnerFlagBadges flags={flagsFor(row)} className="mt-2" />
                    <ListingLinkButton row={row} className="mt-2 min-h-11" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>

      <Sheet open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailRow && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left leading-snug pr-6">
                  {detailRow.address || "Property detail"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <MarketStatusBadge status={detailRow.market_status} />
                  <FreshnessBadge freshness={detailRow.freshness} />
                  <LabelBadge row={detailRow} />
                  {detailRow.listing_kind && (
                    <Badge variant="outline" className="capitalize">
                      {detailRow.listing_kind}
                    </Badge>
                  )}
                  {showOpsUi && (
                    <Badge variant="outline">
                      Internal score {Math.round(rowScore(detailRow))}
                      {detailRow.confidence_band ? ` · ${detailRow.confidence_band}` : ""}
                      {detailRow.frbo_score != null ? ` · FRBO ${detailRow.frbo_score}` : ""}
                      {detailRow.fsbo_score != null ? ` · FSBO ${detailRow.fsbo_score}` : ""}
                    </Badge>
                  )}
                  <OwnerStatusBadges row={detailRow} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Price</span>
                    <div>{money(detailRow.price)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Beds / Baths</span>
                    <div>
                      {detailRow.bedrooms ?? "—"} bd · {detailRow.bathrooms ?? "—"} ba
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Listed</span>
                    <div>{detailRow.listed_date || "—"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last seen active</span>
                    <div>{detailRow.last_seen_active || "—"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Days on market</span>
                    <div>{detailRow.days_on_market ?? "—"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Removed / delisted</span>
                    <div>{detailRow.removed_date || "—"}</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="text-xs font-medium mb-1">Why Brivano scored this lead</div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {parseReasonCodes(detailRow.reason_codes).map((code) => (
                      <Badge key={code} variant="secondary" className="text-[10px]">
                        {code}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {detailRow.qualification_reason || "—"}
                  </p>
                  {detailRow.listing_text_signals?.matched_keywords?.length ? (
                    <p className="text-xs mt-2 text-emerald-700 dark:text-emerald-400">
                      Listing text: {detailRow.listing_text_signals.matched_keywords.join(", ")}
                    </p>
                  ) : null}
                </div>

                <Separator />

                <div>
                  <div className="text-xs font-medium mb-2">Owner & contact</div>
                  <div className="space-y-1 text-xs">
                    <div>Name: {detailRow.owner_name || "Not yet identified"}</div>
                    <div>Owner match: {ownerMatchLabel(detailRow.owner_match_status)}</div>
                    <div>Contact: {contactStatusLabel(detailRow.contact_status)}</div>
                    <div>
                      External verify: {verificationLabel(detailRow.external_verification_status)}
                    </div>
                    {bestEvidenceUrl(detailRow) ? (
                      <div>
                        Evidence:{" "}
                        <a
                          href={bestEvidenceUrl(detailRow)!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          Open listing page
                        </a>
                      </div>
                    ) : null}
                    {marketConflictWarning(detailRow) ? (
                      <div className="text-amber-700 dark:text-amber-400">
                        Market warning: {marketConflictWarning(detailRow)} (badge not changed)
                      </div>
                    ) : null}
                    {detailRow.owner_portfolio_count != null && (
                      <div>Owner active rentals (batch): {detailRow.owner_portfolio_count}</div>
                    )}
                    <div>Phone: {detailRow.owner_phone || "—"}</div>
                    <div>Email: {detailRow.owner_email || "—"}</div>
                    <div>Mailing: {detailRow.owner_mailing_address || "—"}</div>
                    {detailRow.skip_trace_confidence != null && (
                      <div>Skip-trace confidence: {detailRow.skip_trace_confidence}%</div>
                    )}
                    {detailRow.enriched_at && (
                      <div className="text-muted-foreground">
                        Enriched: {new Date(detailRow.enriched_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="text-xs font-medium mb-2">Listing links</div>
                  <div className="flex flex-col gap-1">
                    {listingExternalLinks(detailRow).map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        {link.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!!busy || !detailRow.rentcast_id}
                    onClick={() =>
                      detailRow.rentcast_id && runEnrich([detailRow.rentcast_id])
                    }
                    className="gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Get contact info ({CREDIT_COSTS.enrich} credits)
                  </Button>
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() => onImportOne(detailRow)}
                    className="gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Save to My Leads
                  </Button>
                  {detailRow.imported_lead_id && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/dashboard/leads">View in My Leads</Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
