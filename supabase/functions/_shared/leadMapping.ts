/**
 * Maps a Find Owners listing row to a My Leads insert.
 * Shared by the web app and server functions (Brivano Assistant), so there is one copy.
 */
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function parseReasonCodesForNotes(raw: unknown): string | null {
  if (!raw) return null;
  let codes: string[] = [];
  if (Array.isArray(raw)) codes = raw;
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      codes = Array.isArray(parsed) ? parsed : raw.split(",").map((s) => s.trim()).filter(Boolean);
    } catch {
      codes = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return codes.length ? `Signals: ${codes.join(", ")}` : null;
}

export function buildLeadNotes(row: Row): string {
  const lines = [
    row.qualification ? `Qualification: ${row.qualification}` : null,
    row.confidence_score != null ? `Confidence: ${row.confidence_score}% (${row.confidence_band || "—"})` : null,
    row.frbo_score != null ? `FRBO score: ${row.frbo_score}` : null,
    row.fsbo_score != null ? `FSBO score: ${row.fsbo_score}` : null,
    row.owner_match_status ? `Owner match: ${row.owner_match_status}` : null,
    row.contact_status ? `Contact status: ${row.contact_status}` : null,
    row.classification ? `Classification: ${row.classification}` : null,
    parseReasonCodesForNotes(row.reason_codes),
    row.qualification_reason ? `Reason: ${row.qualification_reason}` : null,
    row.listing_kind ? `Listing type: ${row.listing_kind}` : null,
    row.price != null ? `Price: $${Number(row.price).toLocaleString()}` : null,
    row.rentcast_id ? `Listing ID: ${row.rentcast_id}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildLeadFromRentCast(row: Row, clientId: string) {
  return {
    client_id: clientId,
    business_name: (row.address || "Unknown property").trim(),
    contact_name: row.owner_name?.trim() || null,
    email: row.owner_email?.trim() || null,
    phone: row.owner_phone?.trim() || null,
    city: row.city?.trim() || null,
    state: row.state?.trim() || null,
    zip_code: row.zip_code?.trim() || null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    source_url: row.listing_url?.trim() || null,
    lead_score: row.confidence_score ?? row.fsbo_confidence ?? null,
    industry: "Real Estate",
    notes: buildLeadNotes(row),
    status: "new" as const,
  };
}

export function normalizeAddressKey(address?: string | null): string {
  return (address || "").trim().toLowerCase().replace(/\s+/g, " ");
}

