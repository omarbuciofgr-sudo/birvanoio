import { jsPDF } from "jspdf";
import type { RentCastDiagnostic, RentCastListing, RentCastStats } from "@/lib/api/rentcastApi";
import { CALIBRATION_LABELS } from "@/lib/rentcast/downloadCalibrationCsv";

export type DiagnosticPdfInput = {
  location: string;
  listingType: string;
  confidenceFilter: string;
  limit: string;
  maxFetch: number | null;
  maxScan?: number | null;
  marketTotal?: number | null;
  pagesFetched?: number | null;
  stats: RentCastStats | null;
  poolStats: RentCastStats | null;
  diagnostic: RentCastDiagnostic;
  /** Phase 6: top Likely rows for manual labeling sheet */
  calibrationRows?: RentCastListing[];
};

function safeFilename(location: string) {
  const safeLoc = location.trim().replace(/[^\w.-]+/g, "_") || "search";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `rentcast-diagnostic-${safeLoc}-${stamp}.pdf`;
}

export function downloadDiagnosticPdf(opts: DiagnosticPdfInput) {
  const d = opts.diagnostic;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (need = 18) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const line = (text: string, size = 10, style: "normal" | "bold" = "normal") => {
    ensureSpace(size + 8);
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const rows = doc.splitTextToSize(text, maxW);
    doc.text(rows, margin, y);
    y += rows.length * (size + 3) + 2;
  };

  const section = (title: string) => {
    y += 8;
    ensureSpace(28);
    doc.setFillColor(24, 24, 27);
    doc.rect(margin, y - 12, maxW, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, margin + 8, y + 2);
    doc.setTextColor(0, 0, 0);
    y += 22;
  };

  const kv = (label: string, value: string | number | null | undefined) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value ?? "—"), margin + 170, y);
    y += 14;
  };

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Brivano RentCast Diagnostic Report", margin, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("FSBO / FRBO classification troubleshooting", margin, 52);
  doc.setTextColor(0, 0, 0);
  y = 96;

  section("Search parameters");
  kv("Location", opts.location);
  kv("Listing type", opts.listingType);
  kv("Confidence filter", opts.confidenceFilter);
  kv("UI limit", opts.limit);
  kv("Scan pool", opts.maxFetch ?? "—");
  kv("Scan depth", opts.maxScan ?? d.max_scan ?? "—");
  kv("Market total (RentCast)", opts.marketTotal ?? d.rentcast_total_count ?? "—");
  kv("Pages fetched", opts.pagesFetched ?? d.pages_fetched ?? "—");
  kv("Generated", new Date().toLocaleString());

  section("Pipeline funnel");
  kv("Retrieved", d.total_rentcast_retrieved);
  kv("Market total", d.rentcast_total_count);
  kv("Pages fetched", d.pages_fetched);
  kv("Active", d.total_active);
  kv("Scored", d.total_scored);
  kv("Hard excluded", d.total_hard_excluded);
  kv("Apartments seen", d.apartments_seen);
  kv("Apartments scored", d.apartments_scored);
  kv("Apt complexes excluded", d.apartments_excluded_as_complex ?? d.apartments_excluded);
  kv("No MLS number", d.no_mls_number);
  kv("No MLS name", d.no_mls_name);
  kv("No meaningful agent", d.no_meaningful_agent);
  kv("No meaningful office", d.no_meaningful_office);

  section("Owner lookup");
  kv("Attempted", d.owner_lookup?.attempted);
  kv("Success", d.owner_lookup?.success);
  kv("Failed", d.owner_lookup?.failed);
  kv("Skipped (excluded)", d.owner_lookup?.skipped_excluded);
  kv("Capped", d.owner_lookup?.capped ? "Yes" : "No");
  kv("Rows with owner name", d.rows_with_owner_name);
  kv("Individual owners", d.individual_owners);
  kv("Organization owners", d.organization_owners);
  kv("Owner occupied = false", d.owner_occupied_false);
  kv("PM / institutional hits", d.pm_institutional_keyword_hits);
  kv("Capped no owner signal", d.capped_no_owner_signal);
  kv("Owner match missing", d.owner_match_missing);
  kv("Owner match verified", d.owner_match_verified);

  section("Score distribution");
  kv("Score 20+", d.score_20_plus);
  kv("Score 40+", d.score_40_plus);
  kv("Score 50+", d.score_50_plus);
  kv("Score 60+", d.score_60_plus);
  kv("Score 70+", d.score_70_plus);
  kv("Highest score", d.highest_score);
  kv("Average score", d.average_score);

  if (d.verification) {
    section("External marketplace verification");
    kv("Confirmed FRBO", d.verification.confirmed_frbo);
    kv("Confirmed FSBO", d.verification.confirmed_fsbo);
    kv("Match · owner unknown", d.verification.match_owner_unknown);
    kv("Agent listed (ext)", d.verification.agent_listed);
    kv("No match", d.verification.no_match);
    kv("Not checked", d.verification.not_checked);
  }

  if (d.building_concentration_buckets) {
    section("Apartment building concentration");
    kv("1 unit in batch", d.building_concentration_buckets["1"]);
    kv("2–3 units", d.building_concentration_buckets["2_3"]);
    kv("4–5 units", d.building_concentration_buckets["4_5"]);
    kv("6–9 units", d.building_concentration_buckets["6_9"]);
    kv("10+ (complex)", d.building_concentration_buckets["10_plus"]);
  }

  if (d.property_types) {
    section("Property types (scanned)");
    kv("Single Family", d.property_types.single_family);
    kv("Condo", d.property_types.condo);
    kv("Townhouse", d.property_types.townhouse);
    kv("Multi-Family", d.property_types.multi_family);
    kv("Apartment", d.property_types.apartment);
    kv("Other", d.property_types.other);
  }

  if (opts.stats) {
    section("Returned results (after threshold)");
    kv("Total returned", opts.stats.total);
    kv("Likely FRBO", opts.stats.likely_frbo);
    kv("Likely FSBO", opts.stats.likely_fsbo);
    kv("High band", opts.stats.high_confidence);
  }

  if (opts.poolStats) {
    section("Full scored pool");
    kv("Pool total", opts.poolStats.total);
    kv("Pool likely FRBO", opts.poolStats.likely_frbo);
    kv("Pool likely FSBO", opts.poolStats.likely_fsbo);
  }

  section("Top scoring properties");
  const tops = d.top_properties || [];
  if (!tops.length) {
    line("No top properties in this run.");
  } else {
    tops.forEach((p, idx) => {
      ensureSpace(56);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const title = `${idx + 1}. ${p.address || "—"}  —  Score ${p.score ?? 0}`;
      const titleRows = doc.splitTextToSize(title, maxW);
      doc.text(titleRows, margin, y);
      y += titleRows.length * 12 + 2;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const meta = `${p.listing_kind || "—"} · ${p.property_type || "—"} · ${p.qualification || "—"} · Owner: ${p.owner_name || "Not yet identified"} · Match: ${p.owner_match_status || "—"} · Contact: ${p.contact_status || "—"}`;
      const metaRows = doc.splitTextToSize(meta, maxW);
      doc.text(metaRows, margin, y);
      y += metaRows.length * 11 + 2;

      const parts = (p.score_breakdown || [])
        .map((part) => {
          const pts = part.points ?? 0;
          return `${pts >= 0 ? "+" : ""}${pts} ${part.code || ""}`;
        })
        .join("   ");
      if (parts) {
        const partRows = doc.splitTextToSize(parts, maxW);
        doc.text(partRows, margin, y);
        y += partRows.length * 11 + 6;
      } else {
        y += 6;
      }
      doc.setTextColor(0, 0, 0);
    });
  }

  // Phase 6 — manual validation sheet
  section("Phase 6 — Calibration labels");
  line(
    `Fill human_label with exactly one of: ${CALIBRATION_LABELS.join(" | ")}. Prefer the CSV export for editing; this PDF is a printable checklist.`,
    9,
  );
  line("Do not change confidence scores. Weights are tuned only after labels are returned.", 9);

  const calRows = (opts.calibrationRows || []).slice(0, 50);
  if (!calRows.length) {
    line("No Likely rows in the current table for a labeling sheet. Run Likely (60%+) then Export labels CSV.");
  } else {
    line(`Top Likely in view (${calRows.length} shown, max 50):`, 10, "bold");
    calRows.forEach((r, idx) => {
      ensureSpace(42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const score = r.confidence_score ?? r.fsbo_confidence ?? 0;
      const title = `${idx + 1}. ${r.address || "—"}  —  ${score}%  ·  ${r.qualification || "—"}`;
      const titleRows = doc.splitTextToSize(title, maxW);
      doc.text(titleRows, margin, y);
      y += titleRows.length * 11 + 1;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      const meta = `${r.listing_kind || "—"} · ${r.property_type || "—"} · Owner: ${r.owner_name || "Missing"} · Match: ${r.owner_match_status || "—"} · Contact: ${r.contact_status || "—"} · Verify: ${r.external_verification_status || "not_checked"}`;
      const metaRows = doc.splitTextToSize(meta, maxW);
      doc.text(metaRows, margin, y);
      y += metaRows.length * 10 + 1;
      doc.text("human_label: ____________________   notes: ____________________", margin, y);
      y += 14;
      doc.setTextColor(0, 0, 0);
    });
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Brivano · RentCast diagnostic · Page ${i} of ${pageCount}`, margin, pageH - 24);
    doc.setTextColor(0, 0, 0);
  }

  doc.save(safeFilename(opts.location));
}
