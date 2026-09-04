import type { RentCastListing } from "@/lib/api/rentcastApi";

/** Phase 6 label set from frbo_classification_phases plan. */
export const CALIBRATION_LABELS = [
  "Confirmed Owner",
  "Probably",
  "Agent",
  "PM",
  "Complex",
  "Unable",
] as const;

export type CalibrationLabel = (typeof CALIBRATION_LABELS)[number];

const HEADERS = [
  "rentcast_id",
  "address",
  "city",
  "state",
  "zip_code",
  "listing_kind",
  "property_type",
  "bedrooms",
  "bathrooms",
  "price",
  "qualification",
  "classification",
  "confidence_score",
  "confidence_band",
  "frbo_score",
  "fsbo_score",
  "owner_name",
  "owner_mailing_address",
  "owner_match_status",
  "contact_status",
  "needs_ownership_fallback",
  "external_verification_status",
  "reason_codes",
  "owner_portfolio_count",
  "listing_url",
  "search_location",
  "human_label",
  "notes",
] as const;

function csvEscape(value: unknown): string {
  if (value == null || value === "") return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function reasonCodesCell(raw: RentCastListing["reason_codes"]): string {
  if (Array.isArray(raw)) return raw.join("|");
  if (typeof raw === "string") return raw;
  return "";
}

function rowToCells(row: RentCastListing): string[] {
  return [
    row.rentcast_id ?? "",
    row.address ?? "",
    row.city ?? "",
    row.state ?? "",
    row.zip_code ?? "",
    row.listing_kind ?? "",
    row.property_type ?? "",
    row.bedrooms ?? "",
    row.bathrooms ?? "",
    row.price ?? "",
    row.qualification ?? "",
    row.classification ?? "",
    row.confidence_score ?? row.fsbo_confidence ?? "",
    row.confidence_band ?? "",
    row.frbo_score ?? "",
    row.fsbo_score ?? "",
    row.owner_name ?? "",
    row.owner_mailing_address ?? "",
    row.owner_match_status ?? "",
    row.contact_status ?? "",
    row.needs_ownership_fallback ? "true" : "false",
    row.external_verification_status ?? "",
    reasonCodesCell(row.reason_codes),
    row.owner_portfolio_count ?? "",
    row.listing_url ?? "",
    row.search_location ?? "",
    "", // human_label — fill: Confirmed Owner | Probably | Agent | PM | Complex | Unable
    "", // notes
  ].map(csvEscape);
}

function safeFilename(location: string) {
  const safeLoc = location.trim().replace(/[^\w.-]+/g, "_") || "search";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `rentcast-calibration-${safeLoc}-${stamp}.csv`;
}

/**
 * Download a Phase 6 labeling CSV for the given rows.
 * `human_label` is left blank for the labeler.
 */
export function downloadCalibrationCsv(opts: {
  rows: RentCastListing[];
  location?: string;
}): number {
  const rows = opts.rows || [];
  if (!rows.length) {
    throw new Error("No rows to export. Run a search first (prefer Likely 60%+).");
  }

  const lines = [
    HEADERS.join(","),
    ...rows.map((r) => rowToCells(r).join(",")),
  ];
  // UTF-8 BOM helps Excel open labels cleanly
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(opts.location || "");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return rows.length;
}
