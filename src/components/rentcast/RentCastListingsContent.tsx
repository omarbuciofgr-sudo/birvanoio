import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  rentcastApi,
  type RentCastDiagnostic,
  type RentCastListing,
  type RentCastStats,
} from "@/lib/api/rentcastApi";
import { scraperBackendApi } from "@/lib/api/scraperBackend";
import { supabase } from "@/integrations/supabase/client";
import {
  buildLeadFromRentCast,
  confidenceBadgeClass,
  hasContactInfo,
  listingExternalLinks,
  normalizeAddressKey,
} from "@/lib/rentcast/mapRentCastToLead";
import { downloadDiagnosticPdf } from "@/lib/rentcast/downloadDiagnosticPdf";
import {
  CALIBRATION_LABELS,
  downloadCalibrationCsv,
} from "@/lib/rentcast/downloadCalibrationCsv";

type FilterTab = "all" | "likely_fsbo" | "likely_frbo";
type ListingType = "both" | "sale" | "rental";
type ConfidenceFilter = "likely" | "high" | "all";

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

function QualBadge({ q }: { q?: string }) {
  if (q === "likely_fsbo") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Likely FSBO</Badge>;
  }
  if (q === "likely_frbo") {
    return <Badge className="bg-sky-600 hover:bg-sky-600">Likely FRBO</Badge>;
  }
  return <Badge variant="secondary">Agent listed</Badge>;
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

function ConfidenceBadge({ score, band }: { score?: number | null; band?: string | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <Badge className={confidenceBadgeClass(score)}>{Math.round(score)}%</Badge>
      {band ? <span className="text-[10px] text-muted-foreground">{band}</span> : null}
    </div>
  );
}

function ownerMatchLabel(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "verified":
      return "Verified";
    case "probable":
      return "Probable";
    case "missing":
      return "Missing";
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
    case "no_match":
      return "No external match";
    case "not_checked":
      return "Not checked";
    default:
      return status ? `Verify: ${status}` : "Not checked";
  }
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
  const [location, setLocation] = useState("Naperville, IL");
  const [listingType, setListingType] = useState<ListingType>("both");
  const [limit, setLimit] = useState("50");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("likely");
  const [diagnosticMode, setDiagnosticMode] = useState(false);
  const [diagnostic, setDiagnostic] = useState<RentCastDiagnostic | null>(null);
  const [poolStats, setPoolStats] = useState<RentCastStats | null>(null);
  const [maxFetch, setMaxFetch] = useState<number | null>(null);
  const [maxScan, setMaxScan] = useState<string>("500");
  // Production: hide verify / export / diagnostic UI (handlers kept below)
  const showOpsUi = false;
  const [marketTotal, setMarketTotal] = useState<number | null>(null);
  const [pagesFetched, setPagesFetched] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [listings, setListings] = useState<RentCastListing[]>([]);
  const [stats, setStats] = useState<RentCastStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<RentCastListing | null>(null);
  const [busy, setBusy] = useState<
    "search" | "load" | "enrich" | "verify" | "import" | null
  >(null);

  const filtered = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((r) => r.qualification === filter);
  }, [listings, filter]);

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

  const onSearch = async () => {
    const loc = location.trim();
    if (!loc) {
      toast.error("Enter a city and state (e.g. Naperville, IL)");
      return;
    }
    setBusy("search");
    try {
      const ok = await scraperBackendApi.isScraperBackendReachable();
      if (!ok) {
        toast.error("Scraper backend not reachable. Start it on port 8080 (or set backend URL).");
        return;
      }
      const minConfidence =
        confidenceFilter === "high" ? 80 : confidenceFilter === "likely" ? 60 : 0;
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
      });
      if (!res.success && !res.listings?.length) {
        toast.error(res.error || "RentCast search failed");
        applyResult([], res.stats || null);
        setDiagnostic(diagnosticMode ? res.diagnostic || null : null);
        setPoolStats(res.pool_stats || null);
        setMaxFetch(res.max_fetch ?? null);
        setMarketTotal(res.rentcast_total_count ?? res.diagnostic?.rentcast_total_count ?? null);
        setPagesFetched(res.pages_fetched ?? res.diagnostic?.pages_fetched ?? null);
        return;
      }
      applyResult(res.listings, res.stats || null);
      setDiagnostic(diagnosticMode ? res.diagnostic || null : null);
      setPoolStats(res.pool_stats || null);
      setMaxFetch(res.max_fetch ?? null);
      setMarketTotal(res.rentcast_total_count ?? res.diagnostic?.rentcast_total_count ?? null);
      setPagesFetched(res.pages_fetched ?? res.diagnostic?.pages_fetched ?? null);
      const st = res.stats;
      const diag = res.diagnostic;
      const poolLikely =
        (res.pool_stats?.likely_frbo ?? 0) + (res.pool_stats?.likely_fsbo ?? 0);
      toast.success(
        `Found ${st?.total ?? res.listings?.length ?? 0} listings` +
          (res.saved != null ? ` · saved ${res.saved}` : "") +
          (st
            ? ` · Likely FRBO ${st.likely_frbo ?? 0} · Likely FSBO ${st.likely_fsbo ?? 0}`
            : "") +
          (diag || res.pool_stats
            ? ` · scanned ${diag?.total_scored ?? res.pool_stats?.total ?? "—"} · max score ${diag?.highest_score ?? "—"} · pool likely ${poolLikely}`
            : ""),
      );
      if (res.error) toast.message(String(res.error));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(null);
    }
  };

  const onLoadSaved = async () => {
    setBusy("load");
    try {
      const qualification =
        filter === "likely_fsbo" || filter === "likely_frbo" ? filter : undefined;
      const res = await rentcastApi.leads({
        location: location.trim() || undefined,
        qualification,
        limit: 100,
      });
      if (!res.success && !res.listings?.length) {
        toast.error(res.error || "Failed to load saved leads");
        return;
      }
      applyResult(res.listings, res.stats || null);
      toast.success(`Loaded ${res.listings?.length ?? 0} saved rows`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(null);
    }
  };

  const runEnrich = async (ids?: string[]) => {
    setBusy("enrich");
    try {
      const res = await rentcastApi.enrich({
        location: ids?.length ? undefined : location.trim() || undefined,
        rentcast_ids: ids?.length ? ids : undefined,
        limit: ids?.length ? ids.length : Math.max(likelyInView.length, 10),
        likely_only: !ids?.length,
      });
      if (!res.success) {
        toast.error(res.error || "Enrich failed");
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
      toast.error(e instanceof Error ? e.message : "Enrich failed");
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
        limit: ids?.length ? Math.min(ids.length, 50) : Math.min(likelyInView.length || 20, 20),
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
          `Verify: FRBO ${s.confirmed_frbo ?? 0} · FSBO ${s.confirmed_fsbo ?? 0} · unknown ${s.match_owner_unknown ?? 0} · agent ${s.agent_listed ?? 0} · no match ${s.no_match ?? 0} · not checked ${s.not_checked ?? 0}` +
            (s.configured === false ? " (provider not configured)" : ""),
        );
      } else {
        toast.success(`Verified ${res.total ?? res.results?.length ?? 0} rows`);
      }
      if (res.listings?.length) {
        patchListings(res.listings);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
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
      toast.error(e instanceof Error ? e.message : "CRM import failed");
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
        {!embedded ? (
          <div>
            <h1 className="text-xl font-semibold tracking-tight">RentCast FSBO / FRBO</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pull active listings from RentCast, score likely FSBO/FRBO, enrich owners (RentCast +
              BatchData), and import into CRM.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            RentCast-powered FSBO/FRBO search with confidence scoring. Apartments use a
            secondary classifier (building concentration + owner unlock); institutional
            operators are capped out of Likely.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/40 bg-muted/20 p-3">
          <div className="w-full space-y-1 sm:w-52">
            <label className="text-[11px] text-muted-foreground">City, State</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Naperville, IL"
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
          </div>
          <div className="w-full space-y-1 sm:w-36">
            <label className="text-[11px] text-muted-foreground">Type</label>
            <Select value={listingType} onValueChange={(v) => setListingType(v as ListingType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Sale + Rental</SelectItem>
                <SelectItem value="sale">Sale only</SelectItem>
                <SelectItem value="rental">Rental only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1 sm:w-24">
            <label className="text-[11px] text-muted-foreground">Limit</label>
            <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" />
          </div>
          <div className="w-full space-y-1 sm:w-40">
            <label className="text-[11px] text-muted-foreground">Confidence</label>
            <Select
              value={confidenceFilter}
              onValueChange={(v) => setConfidenceFilter(v as ConfidenceFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="likely">Likely (60%+)</SelectItem>
                <SelectItem value="high">High (80%+)</SelectItem>
                <SelectItem value="all">All scored</SelectItem>
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
          {showOpsUi && (
            <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
              <Checkbox
                checked={diagnosticMode}
                onCheckedChange={(v) => setDiagnosticMode(v === true)}
              />
              Diagnostic
            </label>
          )}
          <Button onClick={onSearch} disabled={!!busy} className="gap-1.5">
            {busy === "search" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search RentCast
          </Button>
          <Button variant="outline" onClick={onLoadSaved} disabled={!!busy} className="gap-1.5">
            {busy === "load" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Load saved
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
            Enrich selected ({selectedCount})
          </Button>
          <Button
            variant="secondary"
            onClick={onEnrichAllLikely}
            disabled={!!busy || likelyCount === 0}
            className="gap-1.5"
          >
            Enrich all likely ({likelyCount})
          </Button>
          {showOpsUi && (
            <>
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
                Verify selected ({selectedCount})
              </Button>
              <Button
                variant="secondary"
                onClick={onVerifyTopLikely}
                disabled={!!busy || likelyCount === 0}
                className="gap-1.5"
              >
                Verify top likely ({Math.min(likelyCount, 20)})
              </Button>
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
            Add to CRM ({selectedCount})
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

        {stats && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Total {stats.total ?? 0}</Badge>
            <Badge variant="outline">Sale {stats.sale ?? 0}</Badge>
            <Badge variant="outline">Rental {stats.rental ?? 0}</Badge>
            <Badge variant="outline">Likely FSBO {stats.likely_fsbo ?? 0}</Badge>
            <Badge variant="outline">Likely FRBO {stats.likely_frbo ?? 0}</Badge>
            <Badge variant="outline">High {stats.high_confidence ?? 0}</Badge>
            <Badge variant="outline">Likely band {stats.likely_band ?? 0}</Badge>
            {maxFetch != null && <Badge variant="outline">Scan pool {maxFetch}</Badge>}
            {marketTotal != null && (
              <Badge variant="outline">Market total {marketTotal.toLocaleString()}</Badge>
            )}
            {pagesFetched != null && pagesFetched > 0 && (
              <Badge variant="outline">Pages {pagesFetched}</Badge>
            )}
            {poolStats && (
              <Badge variant="outline">
                Pool likely {(poolStats.likely_frbo ?? 0) + (poolStats.likely_fsbo ?? 0)}
              </Badge>
            )}
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
            {diagnostic.building_concentration_buckets && (
              <div className="text-muted-foreground">
                Building concentration — 1: {diagnostic.building_concentration_buckets["1"] ?? 0}, 2–3:{" "}
                {diagnostic.building_concentration_buckets["2_3"] ?? 0}, 4–5:{" "}
                {diagnostic.building_concentration_buckets["4_5"] ?? 0}, 6–9:{" "}
                {diagnostic.building_concentration_buckets["6_9"] ?? 0}, 10+:{" "}
                {diagnostic.building_concentration_buckets["10_plus"] ?? 0}
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

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["likely_fsbo", "Likely FSBO"],
              ["likely_frbo", "Likely FRBO"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="rounded-lg border border-border/40 overflow-hidden">
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
                <TableHead>Kind</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Listing</TableHead>
                <TableHead>Owner / Contact</TableHead>
                <TableHead>CRM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-10">
                    No rows yet. Search RentCast or Load saved.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const id = row.rentcast_id || row.address || "";
                  const links = listingExternalLinks(row);
                  return (
                    <TableRow key={id}>
                      <TableCell>
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
                          onClick={() => setDetailRow(row)}
                        >
                          {row.address || "—"}
                        </button>
                        <div className="text-[11px] text-muted-foreground">
                          {[row.bedrooms != null ? `${row.bedrooms} bd` : null, row.bathrooms != null ? `${row.bathrooms} ba` : null, row.property_type]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{row.listing_kind || "—"}</TableCell>
                      <TableCell>
                        <QualBadge q={row.qualification} />
                      </TableCell>
                      <TableCell>
                        <ConfidenceBadge score={rowScore(row)} band={row.confidence_band} />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{money(row.price)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {links.slice(0, 2).map((link) => (
                            <a
                              key={link.label}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              {link.label}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        <div className="truncate">{row.owner_name || "Not yet identified"}</div>
                        <div className="text-muted-foreground truncate">
                          {row.owner_phone || row.owner_email || row.owner_mailing_address || ""}
                        </div>
                        <OwnerStatusBadges row={row} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.imported_lead_id ? (
                          <Link
                            to="/dashboard/leads"
                            className="text-primary hover:underline"
                          >
                            In CRM
                          </Link>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            disabled={!!busy}
                            onClick={() => onImportOne(row)}
                          >
                            Add
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
                  <QualBadge q={detailRow.qualification} />
                  <ConfidenceBadge score={rowScore(detailRow)} band={detailRow.confidence_band} />
                  {detailRow.classification && (
                    <Badge variant="outline">{detailRow.classification}</Badge>
                  )}
                  {detailRow.listing_kind && (
                    <Badge variant="outline" className="capitalize">
                      {detailRow.listing_kind}
                    </Badge>
                  )}
                  {detailRow.frbo_score != null && (
                    <Badge variant="outline">FRBO {detailRow.frbo_score}</Badge>
                  )}
                  {detailRow.fsbo_score != null && (
                    <Badge variant="outline">FSBO {detailRow.fsbo_score}</Badge>
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
                    Enrich
                  </Button>
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() => onImportOne(detailRow)}
                    className="gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add to CRM
                  </Button>
                  {detailRow.imported_lead_id && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/dashboard/leads">View in CRM</Link>
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
