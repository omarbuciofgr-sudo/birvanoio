import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DataPageSkeleton from "@/components/dashboard/DataPageSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, Phone, Mail, Send, Sparkles, ImageOff } from "lucide-react";
import { rentcastApi, type RentCastListing } from "@/lib/api/rentcastApi";
import { CREDIT_COSTS, useCredits } from "@/hooks/useCredits";
import { OwnerFlagBadges } from "@/components/rentcast/OwnerFlagBadges";
import { AIWritingError, writeTalkingPointsForListing, writeWithAI } from "@/lib/ai/claudeWriter";
import {
  computeFlags, daysListed, listingKind, marketComparison, type PropertyEstimate,
} from "@/lib/ownerFlags";
import { normalizeAddressKey } from "@/lib/rentcast/mapRentCastToLead";
import { SetFollowUp } from "@/components/leads/SetFollowUp";
import { LogContactButton } from "@/components/leads/LogContactButton";
import { OwnerScripts } from "@/components/rentcast/OwnerScripts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, FileText } from "lucide-react";
import { MarketReportDialog } from "@/components/rentcast/MarketReportDialog";

const money = (n?: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
};

function photosOf(r: RentCastListing): string[] {
  const x = r as Record<string, unknown>;
  const out: string[] = [];
  for (const k of ["photos", "images", "image_urls"]) {
    const v = x[k];
    if (Array.isArray(v)) v.forEach((p) => { const u = typeof p === "string" ? p : (p as any)?.url; if (typeof u === "string") out.push(u); });
  }
  for (const k of ["image", "img_src", "photo_url", "thumbnail"]) if (typeof x[k] === "string") out.push(x[k] as string);
  return [...new Set(out)].filter((u) => /^https:\/\//.test(u)).slice(0, 12);
}

export default function OwnerDetail() {
  const { ref = "" } = useParams();
  const navigate = useNavigate();
  const { canAfford } = useCredits();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<RentCastListing | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<PropertyEstimate | null>(null);
  const [estLoading, setEstLoading] = useState(false);
  const [estNote, setEstNote] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [points, setPoints] = useState("");
  const [writing, setWriting] = useState(false);
  const [aiError, setAiError] = useState<{ message: string; limit: boolean } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Load the owner: from saved search results, or from a saved lead ("lead:<id>").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const decoded = decodeURIComponent(ref);
      let listing: RentCastListing | null = null;
      let ext: string | null = null;
      let lid: string | null = null;
      if (decoded.startsWith("lead:")) {
        lid = decoded.slice(5);
        const { data: lead } = await supabase.from("leads")
          .select("id, business_name, contact_name, phone, email, city, state, zip_code, notes").eq("id", lid).maybeSingle();
        if (lead) {
          const { data: match } = await (supabase as any).from("owner_search_results")
            .select("external_id, listing_data").eq("user_id", auth.user.id)
            .ilike("listing_data->>address", lead.business_name).limit(1).maybeSingle();
          listing = match?.listing_data ?? {
            address: lead.business_name, city: lead.city, state: lead.state, zip_code: lead.zip_code,
            listing_kind: /rent|frbo/i.test(lead.notes || "") ? "rental" : "sale",
          };
          ext = match?.external_id ?? null;
          listing = {
            ...listing,
            owner_name: listing!.owner_name || lead.contact_name,
            owner_phone: listing!.owner_phone || lead.phone,
            owner_email: listing!.owner_email || lead.email,
            imported_lead_id: lead.id,
          };
        }
      } else {
        const { data } = await (supabase as any).from("owner_search_results")
          .select("external_id, listing_data").eq("user_id", auth.user.id).eq("external_id", decoded).maybeSingle();
        listing = data?.listing_data ?? null;
        ext = data?.external_id ?? null;
        lid = listing?.imported_lead_id ?? null;
      }
      if (cancelled) return;
      setRow(listing);
      setExternalId(ext);
      setLeadId(lid);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ref]);

  // Market estimate (cached server-side for 7 days).
  useEffect(() => {
    if (!row?.address) return;
    let cancelled = false;
    setEstLoading(true);
    const address = [row.address, row.city, row.state, row.zip_code].some((p, i) => i > 0 && p && !row.address!.includes(String(p)))
      ? [row.address, row.city, row.state, row.zip_code].filter(Boolean).join(", ")
      : row.address;
    supabase.functions
      .invoke("property-estimate", { body: { mode: "fetch", items: [{ address, kind: listingKind(row) }] } })
      .then(({ data }) => {
        if (cancelled) return;
        setEstimate(data?.estimate ?? null);
        setEstNote(data?.estimate ? null : data?.error || "Market estimate isn't available for this property yet.");
      })
      .catch(() => !cancelled && setEstNote("Market estimate isn't available right now."))
      .finally(() => !cancelled && setEstLoading(false));
    return () => { cancelled = true; };
  }, [row?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  const flags = useMemo(() => (row ? computeFlags(row, estimate) : []), [row, estimate]);
  const cmp = row ? marketComparison(row, estimate) : null;
  const rental = row ? listingKind(row) === "rental" : false;
  const suffix = rental ? "/mo" : "";
  const history = estimate?.price_history ?? [];
  const photos = row ? photosOf(row) : [];

  const onGetContact = async () => {
    if (!row?.rentcast_id) return;
    if (!canAfford("enrich", 1)) {
      toast.error(`You need ${CREDIT_COSTS.enrich} credits to get this contact info.`);
      return;
    }
    setEnriching(true);
    try {
      const res = await rentcastApi.enrich({ rentcast_ids: [row.rentcast_id], limit: 1, likely_only: false });
      const updated = res.listings?.find((l) => l.rentcast_id === row.rentcast_id);
      if (!res.success || !updated) throw new Error("no result");
      const next = { ...row, ...updated };
      setRow(next);
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await (supabase as any).from("owner_search_results").update({ listing_data: next })
          .eq("user_id", auth.user.id).eq("external_id", externalId || row.rentcast_id || normalizeAddressKey(row.address));
      }
      toast.success(next.owner_phone || next.owner_email ? "Contact info found." : "No contact info found for this owner.");
    } catch {
      toast.error("We couldn't get contact info right now. Please try again.");
    } finally {
      setEnriching(false);
    }
  };

  const onTalkingPoints = async () => {
    setWriting(true);
    setAiError(null);
    try {
      const text = externalId
        ? await writeTalkingPointsForListing(externalId)
        : await writeWithAI("talking_points", leadId!);
      setPoints(text);
    } catch (e) {
      const err = e instanceof AIWritingError ? e : new AIWritingError("Something went wrong writing that. Please try again.");
      setAiError({ message: err.message, limit: err.code === "ai_limit" });
    } finally {
      setWriting(false);
    }
  };

  if (loading) return <DashboardLayout><DataPageSkeleton /></DashboardLayout>;

  if (!row) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">We couldn't find this owner in your saved results.</p>
          <Button asChild size="sm"><Link to="/dashboard/scraper?tab=real-estate">Back to Find Owners</Link></Button>
        </div>
      </DashboardLayout>
    );
  }

  const days = daysListed(row, estimate);
  const hasContact = !!(row.owner_phone || row.owner_email);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-5 pb-20 md:pb-0">
        <Button variant="ghost" size="sm" className="min-h-11 -ml-2 md:h-8 md:min-h-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{rental ? "Renting" : "Selling"}</Badge>
            {leadId && <Badge variant="outline">Saved to My Leads</Badge>}
          </div>
          <h1 className="font-display text-2xl font-semibold leading-tight">{row.address || "Unknown address"}</h1>
          <p className="text-sm text-muted-foreground">{[row.city, row.state, row.zip_code].filter(Boolean).join(", ")}</p>
          <OwnerFlagBadges flags={flags} />
          <Button size="sm" className="min-h-11 md:h-8 md:min-h-0" onClick={() => setReportOpen(true)}>
            <FileText className="h-4 w-4 mr-1" /> Create market report
          </Button>
        </div>
        {reportOpen && (
          <MarketReportDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            row={row}
            photoUrl={photos[0] ?? null}
            leadId={leadId}
            listingId={externalId}
            ownerEmail={row.owner_email ?? null}
          />
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="scripts" className="text-xs">Scripts</TabsTrigger>
          </TabsList>
          <TabsContent value="scripts">
            <OwnerScripts
              selling={!rental}
              leadId={leadId}
              listingId={externalId}
              phone={row.owner_phone ?? null}
              email={row.owner_email ?? null}
            />
          </TabsContent>
          <TabsContent value="overview" className="space-y-5">
        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((src) => (
              <img key={src} src={src} alt={`Photo of ${row.address}`} loading="lazy" className="h-48 w-72 flex-none rounded-lg object-cover border border-border" />
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            <ImageOff className="h-4 w-4" /> No photos available for this listing
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-2 space-y-5">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Listing</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <Field label="Price" value={`${money(row.price)}${row.price ? suffix : ""}`} />
                <Field label="Date listed" value={fmtDate(row.listed_date || estimate?.listed_date)} />
                <Field label="Days on market" value={days != null ? String(days) : "—"} />
                <Field label="Beds" value={row.bedrooms != null ? String(row.bedrooms) : "—"} />
                <Field label="Baths" value={row.bathrooms != null ? String(row.bathrooms) : "—"} />
                <Field label="Sq ft" value={row.square_footage != null ? row.square_footage.toLocaleString("en-US") : "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{rental ? "Estimated rent" : "Estimated value"}</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                {estLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : estimate?.estimate ? (
                  <>
                    <p className="text-lg font-semibold">
                      {money(estimate.estimate)}{suffix}
                      {estimate.range_low && estimate.range_high && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          range {money(estimate.range_low)} to {money(estimate.range_high)}
                        </span>
                      )}
                    </p>
                    {cmp && (
                      <p className="text-muted-foreground">
                        Asking {money(cmp.asking)}{suffix} – market estimate about {money(cmp.estimate)}{suffix}{" "}
                        {Math.abs(cmp.pct) < 1
                          ? "(right at market)"
                          : `(about ${Math.round(Math.abs(cmp.pct))}% ${cmp.pct > 0 ? "above" : "below"})`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">{estNote}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Price history</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {estLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : history.length ? (
                  <ul className="divide-y divide-border">
                    {[...history].reverse().map((h, i) => (
                      <li key={`${h.date}-${i}`} className="flex justify-between py-2">
                        <span>{fmtDate(h.date)} <span className="text-muted-foreground">· {h.event}</span></span>
                        <span className="font-medium">{money(h.price)}{h.price ? suffix : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No price changes on record.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Owner</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium">{row.owner_name || "Not yet identified"}</p>
                {hasContact ? (
                  <div className="space-y-1.5">
                    {row.owner_phone && (
                      <a href={`tel:${row.owner_phone}`} className="flex items-center gap-2 hover:underline"><Phone className="h-3.5 w-3.5" />{row.owner_phone}</a>
                    )}
                    {row.owner_email && (
                      <a href={`mailto:${row.owner_email}`} className="flex items-center gap-2 hover:underline break-all"><Mail className="h-3.5 w-3.5" />{row.owner_email}</a>
                    )}
                  </div>
                ) : row.rentcast_id ? (
                  <Button size="sm" className="w-full" onClick={onGetContact} disabled={enriching}>
                    {enriching && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Get contact info ({CREDIT_COSTS.enrich} credits)
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">No contact info saved for this owner.</p>
                )}
                {leadId && (
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to={`/dashboard/leads/${leadId}`}>Open full lead record</Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" />Set follow-up</CardTitle></CardHeader>
              <CardContent>
                {leadId ? (
                  <div className="space-y-3">
                    <LogContactButton leadId={leadId} />
                    <SetFollowUp leadId={leadId} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Save this owner to My Leads from Find Owners to set follow-ups.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Talking points</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">3 short conversation openers based on this listing.</p>
                <Button size="sm" variant="outline" className="w-full" onClick={onTalkingPoints} disabled={writing || (!externalId && !leadId)}>
                  {writing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {points ? "Write new openers" : "Write talking points"}
                </Button>
                {aiError && (
                  <p className="text-xs text-destructive">
                    {aiError.message}{" "}
                    {aiError.limit && <Link to="/dashboard/billing" className="underline">Upgrade</Link>}
                  </p>
                )}
                {writing && !points ? (
                  <Skeleton className="h-28 w-full" />
                ) : points ? (
                  <>
                    <Textarea value={points} onChange={(e) => setPoints(e.target.value)} rows={8} className="text-sm" />
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => { navigator.clipboard.writeText(points); toast.success("Copied"); }}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
          </TabsContent>
        </Tabs>
      </div>
      <div className="fixed inset-x-0 z-40 grid grid-cols-3 gap-2 border-t border-border bg-background/95 px-3 py-2 backdrop-blur-xl md:hidden bottom-[calc(60px+env(safe-area-inset-bottom))]">
        {row.owner_phone ? (
          <Button asChild size="lg" className="h-12"><a href={`tel:${row.owner_phone}`}><Phone className="h-5 w-5" />Call</a></Button>
        ) : (
          <Button size="lg" className="h-12" disabled><Phone className="h-5 w-5" />Call</Button>
        )}
        {row.owner_phone ? (
          <Button asChild size="lg" variant="outline" className="h-12"><a href={`sms:${row.owner_phone}`}><Send className="h-5 w-5" />Text</a></Button>
        ) : (
          <Button size="lg" variant="outline" className="h-12" disabled><Send className="h-5 w-5" />Text</Button>
        )}
        {row.owner_email ? (
          <Button asChild size="lg" variant="outline" className="h-12"><a href={`mailto:${row.owner_email}`}><Mail className="h-5 w-5" />Email</a></Button>
        ) : (
          <Button size="lg" variant="outline" className="h-12" disabled><Mail className="h-5 w-5" />Email</Button>
        )}
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
