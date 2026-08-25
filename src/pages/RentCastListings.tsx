import { useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  rentcastApi,
  type RentCastListing,
  type RentCastStats,
} from "@/lib/api/rentcastApi";
import { scraperBackendApi } from "@/lib/api/scraperBackend";

type FilterTab = "all" | "likely_fsbo" | "likely_frbo";
type ListingType = "both" | "sale" | "rental";

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

export default function RentCastListings() {
  const [location, setLocation] = useState("Naperville, IL");
  const [listingType, setListingType] = useState<ListingType>("both");
  const [limit, setLimit] = useState("25");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [listings, setListings] = useState<RentCastListing[]>([]);
  const [stats, setStats] = useState<RentCastStats | null>(null);
  const [busy, setBusy] = useState<"search" | "load" | "enrich" | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((r) => r.qualification === filter);
  }, [listings, filter]);

  const applyResult = (rows: RentCastListing[] | undefined, s?: RentCastStats | null) => {
    setListings(Array.isArray(rows) ? rows : []);
    if (s) setStats(s);
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
      const res = await rentcastApi.search({
        location: loc,
        type: listingType,
        limit: Math.max(1, Math.min(Number(limit) || 25, 100)),
        save: true,
      });
      if (!res.success && !res.listings?.length) {
        toast.error(res.error || "RentCast search failed");
        applyResult([], res.stats || null);
        return;
      }
      applyResult(res.listings, res.stats || null);
      const st = res.stats;
      toast.success(
        `Found ${st?.total ?? res.listings?.length ?? 0} listings` +
          (res.saved != null ? ` · saved ${res.saved}` : "") +
          (st ? ` · Likely FRBO ${st.likely_frbo ?? 0} · Likely FSBO ${st.likely_fsbo ?? 0}` : ""),
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

  const onEnrich = async () => {
    setBusy("enrich");
    try {
      const res = await rentcastApi.enrich({
        location: location.trim() || undefined,
        limit: 5,
      });
      if (!res.success) {
        toast.error(res.error || "Enrich failed");
        return;
      }
      toast.success(`Enriched ${res.total ?? res.results?.length ?? 0} likely leads`);
      await onLoadSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardLayout fullWidth>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">RentCast FSBO / FRBO</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pull active sale/rental listings from RentCast, flag Likely FSBO/FRBO (no MLS / agent /
            office), then enrich owners. Does not replace scrapers.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1 space-y-1">
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSearch} disabled={!!busy} className="gap-1.5">
              {busy === "search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search RentCast
            </Button>
            <Button variant="outline" onClick={onLoadSaved} disabled={!!busy} className="gap-1.5">
              {busy === "load" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Load saved
            </Button>
            <Button variant="secondary" onClick={onEnrich} disabled={!!busy} className="gap-1.5">
              {busy === "enrich" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Enrich likely (5)
            </Button>
          </div>
        </div>

        {stats && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Total {stats.total ?? 0}</Badge>
            <Badge variant="outline">Sale {stats.sale ?? 0}</Badge>
            <Badge variant="outline">Rental {stats.rental ?? 0}</Badge>
            <Badge variant="outline">Likely FSBO {stats.likely_fsbo ?? 0}</Badge>
            <Badge variant="outline">Likely FRBO {stats.likely_frbo ?? 0}</Badge>
            <Badge variant="outline">Agent {stats.agent_listed ?? 0}</Badge>
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
                <TableHead>Address</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>MLS / Agent</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                    No rows yet. Search RentCast or Load saved.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.rentcast_id || row.address || Math.random()}>
                    <TableCell className="max-w-[280px] text-sm">
                      <div className="font-medium leading-snug">{row.address || "—"}</div>
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
                    <TableCell className="text-sm whitespace-nowrap">{money(row.price)}</TableCell>
                    <TableCell className="text-xs max-w-[180px]">
                      <div>{row.mls_number || row.mls_name || "—"}</div>
                      <div className="text-muted-foreground truncate">
                        {row.listing_agent_name || row.listing_office_name || "No agent/office"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[160px]">
                      <div className="truncate">{row.owner_name || "—"}</div>
                      <div className="text-muted-foreground truncate">{row.owner_mailing_address || ""}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
