import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, Loader2, Mail, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import type { RentCastListing } from "@/lib/api/rentcastApi";
import { listingKind, type PropertyEstimate } from "@/lib/ownerFlags";
import { AIWritingError, writeForOwner } from "@/lib/ai/claudeWriter";
import { buildMarketReportPdf, toDataUrl, type Comparable, type MarketReportData } from "@/lib/marketReportPdf";
import { useCredits } from "@/hooks/useCredits";

const REPORT_CREDITS = 3;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: RentCastListing;
  photoUrl: string | null;
  leadId: string | null;
  listingId: string | null;
  ownerEmail: string | null;
};

export function MarketReportDialog({ open, onOpenChange, row, photoUrl, leadId, listingId, ownerEmail }: Props) {
  const { refetch } = useCredits() as ReturnType<typeof useCredits> & { refetch?: () => void };
  const reportId = useRef<string>(crypto.randomUUID());
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<Omit<MarketReportData, "summary"> | null>(null);
  const [summary, setSummary] = useState("");
  const [writing, setWriting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "email" | null>(null);
  const [subject, setSubject] = useState(`Market report for ${row.address}`);
  const rental = listingKind(row) === "rental";

  const writeSummary = useCallback(async () => {
    setWriting(true);
    setAiError(null);
    try {
      setSummary(await writeForOwner("market_report_summary", { leadId, listingId }));
    } catch (e) {
      setAiError(e instanceof AIWritingError ? e.message : "We couldn't write the summary. You can type your own.");
    } finally {
      setWriting(false);
    }
  }, [leadId, listingId]);

  // Load estimate + comparables, agent branding and the AI summary when opened.
  useEffect(() => {
    if (!open) return;
    reportId.current = crypto.randomUUID();
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: est }, { data: auth }] = await Promise.all([
        supabase.functions.invoke("property-estimate", {
          body: { mode: "fetch", withComps: true, items: [{ address: row.address, kind: listingKind(row) }] },
        }).catch(() => ({ data: null })),
        supabase.auth.getUser(),
      ]);
      const e = (est?.estimate ?? null) as (PropertyEstimate & { comparables?: Comparable[] | null }) | null;
      const { data: p } = auth.user
        ? await supabase.from("profiles").select("first_name, last_name, brokerage, company_name, phone, email, agent_photo_path").eq("user_id", auth.user.id).maybeSingle()
        : { data: null };
      const prof = p as Record<string, string | null> | null;
      let agentPhoto: string | null = null;
      if (prof?.agent_photo_path) {
        const { data: signed } = await supabase.storage.from("agent-photos").createSignedUrl(prof.agent_photo_path, 600);
        agentPhoto = await toDataUrl(signed?.signedUrl);
      }
      const propPhoto = await toDataUrl(photoUrl);
      if (cancelled) return;
      setBase({
        address: row.address || "Property",
        cityLine: [row.city, row.state, row.zip_code].filter(Boolean).join(", "),
        rental,
        asking: row.price ?? null,
        estimate: e?.estimate ?? null,
        rangeLow: e?.range_low ?? null,
        rangeHigh: e?.range_high ?? null,
        beds: row.bedrooms ?? null,
        baths: row.bathrooms ?? null,
        sqft: row.square_footage ?? null,
        photo: propPhoto,
        comparables: (e?.comparables ?? []).slice(0, 5),
        agent: {
          name: [prof?.first_name, prof?.last_name].filter(Boolean).join(" "),
          brokerage: prof?.brokerage || prof?.company_name || "",
          phone: prof?.phone || "",
          email: prof?.email || auth.user?.email || "",
          photo: agentPhoto,
        },
      });
      setLoading(false);
    })();
    writeSummary();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Refresh the PDF preview when data or summary changes (debounced).
  useEffect(() => {
    if (!base) return;
    const t = setTimeout(() => {
      const url = URL.createObjectURL(buildMarketReportPdf({ ...base, summary }).output("blob"));
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
    }, 500);
    return () => clearTimeout(t);
  }, [base, summary]);

  const pay = async (mode: "download" | "email", extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("market-report", {
      body: { reportId: reportId.current, address: row.address, mode, ...extra },
    });
    if (error || !data?.success) {
      let msg = "Something went wrong. Please try again.";
      try { const b = await (error as any)?.context?.json?.(); if (b?.error) msg = b.error; } catch { /* keep default */ }
      if (data?.error) msg = data.error;
      throw new Error(msg);
    }
    refetch?.();
    return data;
  };

  const onDownload = async () => {
    if (!base) return;
    setBusy("download");
    try {
      const doc = buildMarketReportPdf({ ...base, summary });
      await pay("download");
      doc.save(`Market report - ${row.address}.pdf`);
      toast.success("Report downloaded.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  };

  const onEmail = async () => {
    if (!base || !leadId) return;
    setBusy("email");
    try {
      const pdfBase64 = buildMarketReportPdf({ ...base, summary }).output("datauristring").split(",")[1];
      await pay("email", { leadId, pdfBase64, subject, message: `Hi${row.owner_name ? ` ${row.owner_name.split(" ")[0]}` : ""}, I put together a short market report for ${row.address}. It's attached as a PDF. Happy to answer any questions.` });
      toast.success("Report emailed to the owner.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  };

  const canEmail = !!leadId && !!ownerEmail;
  const missingBranding = base && (!base.agent.name || !base.agent.brokerage || !base.agent.phone || !base.agent.photo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Market report</DialogTitle>
          <DialogDescription>Review and edit the summary, then download or email the PDF. Each report uses {REPORT_CREDITS} credits.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Summary</label>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={writeSummary} disabled={writing}>
                  {writing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}Rewrite
                </Button>
              </div>
              {writing && !summary ? <Skeleton className="h-40 w-full" /> : (
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={8} maxLength={1200} placeholder="Write a short summary for the owner." />
              )}
              {aiError && <p className="text-xs text-destructive">{aiError}</p>}
            </div>
            {base && (
              <p className="text-xs text-muted-foreground">
                {base.comparables.length ? `${base.comparables.length} comparable nearby properties included.` : "No comparable properties were available for this address."}
                {base.estimate == null && " No market estimate is available for this property."}
              </p>
            )}
            {missingBranding && (
              <p className="text-xs text-muted-foreground">
                Add your photo, brokerage and phone in <Link to="/dashboard/settings" className="underline">Settings &gt; Profile</Link> to brand your reports.
              </p>
            )}
            <div className="space-y-2 border-t border-border pt-4">
              <Button className="w-full" onClick={onDownload} disabled={!base || !!busy || writing}>
                {busy === "download" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Download PDF ({REPORT_CREDITS} credits)
              </Button>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} disabled={!canEmail} aria-label="Email subject" />
              <Button variant="outline" className="w-full" onClick={onEmail} disabled={!base || !!busy || writing || !canEmail}>
                {busy === "email" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                Email to owner
              </Button>
              <p className="text-xs text-muted-foreground">
                {canEmail ? "Downloading and emailing the same report only uses credits once." : "To email it, save this owner to My Leads with an email address."}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 min-h-[520px] overflow-hidden">
            {loading || !previewUrl ? (
              <div className="flex h-full min-h-[520px] items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Building preview…
              </div>
            ) : (
              <iframe title="Report preview" src={`${previewUrl}#toolbar=0&view=FitH`} className="h-[640px] w-full" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
