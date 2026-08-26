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

type FilterTab = "all" | "likely_fsbo" | "likely_frbo";
type ListingType = "both" | "sale" | "rental";

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

function ConfidenceBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge className={confidenceBadgeClass(score)}>
      {Math.round(score)}%
    </Badge>
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
  const [limit, setLimit] = useState("25");
  const [likelyOnly, setLikelyOnly] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [listings, setListings] = useState<RentCastListing[]>([]);
  const [stats, setStats] = useState<RentCastStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<RentCastListing | null>(null);
  const [busy, setBusy] = useState<
    "search" | "load" | "enrich" | "import" | null
  >(null);

  const filtered = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((r) => r.qualification === filter);
  }, [listings, filter]);

  const likelyInView = useMemo(
    () =>
      filtered.filter((r) =>
        ["likely_fsbo", "likely_frbo"].includes(r.qualification || ""),
      ),
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
      const res = await rentcastApi.search({
        location: loc,
        type: listingType,
        limit: Math.max(1, Math.min(Number(limit) || 25, 100)),
        save: true,
        likely_only: likelyOnly,
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
          (st
            ? ` · Likely FRBO ${st.likely_frbo ?? 0} · Likely FSBO ${st.likely_fsbo ?? 0}`
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
        toast.success(
          `Enrich done: ${summary.enriched ?? 0} with contact · ${summary.partial ?? 0} partial · ${summary.no_contact ?? 0} no contact · ${summary.failed ?? 0} failed`,
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
          await supabase
            .from("rentcast_listings")
            .update({ imported_lead_id: leadId })
            .eq("rentcast_id", row.rentcast_id)
            .then(() => undefined)
            .catch(() => undefined);
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

  return (
    <>
      <div className="space-y-5">
        {!embedded && (
          <div>
            <h1 className="text-xl font-semibold tracking-tight">RentCast FSBO / FRBO</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pull active listings from RentCast, score likely FSBO/FRBO, enrich owners (RentCast +
              BatchData), and import into CRM.
            </p>
          </div>
        )}

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
          <label className="flex items-center gap-2 text-xs pb-2 cursor-pointer">
            <Checkbox checked={likelyOnly} onCheckedChange={(v) => setLikelyOnly(v === true)} />
            Likely FSBO/FRBO only
          </label>
          <div className="flex flex-wrap gap-2">
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
                        <ConfidenceBadge score={row.fsbo_confidence} />
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
                      <TableCell className="text-xs max-w-[180px]">
                        <div className="truncate">{row.owner_name || "—"}</div>
                        <div className="text-muted-foreground truncate">
                          {row.owner_phone || row.owner_email || row.owner_mailing_address || ""}
                        </div>
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
                  <ConfidenceBadge score={detailRow.fsbo_confidence} />
                  {detailRow.listing_kind && (
                    <Badge variant="outline" className="capitalize">
                      {detailRow.listing_kind}
                    </Badge>
                  )}
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
                  <div className="text-xs font-medium mb-1">Qualification reason</div>
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
                    <div>Name: {detailRow.owner_name || "—"}</div>
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
