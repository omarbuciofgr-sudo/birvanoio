/**
 * Client-side “by-owner only” visibility for names that appear only after skip trace
 * (backend filters DB rows; React state can gain owner_name without a re-fetch).
 * Keep in sync with Omar_bucio_backend_Scraper-main/utils/pm_realtor_filter.py.
 */
const CORP_ENTITY_RE =
  /\b(?:llc\.?|l\.?\s*l\.?\s*c\.?|l\.l\.c\.?|inc\.?|corp\.?|corporation|ltd\.?|l\.l\.p\.?|llp\.?|lp\.?|holdings?|propco|prop\s*co|partnership|realty\s+trust|properties\s+llc)\b/i;

const INSTITUTIONAL_NAME_RE =
  /(?:property\s+compan(?:y|ies)|management\s+group|realty\s+group|residential\s+group|investment\s+group|housing\s+group|development\s+group|asset\s+management|\b\w+\s+companies\b|\b\w+\s+real\s+estate\b|\budr\b|multifamily|apartment\s+communities|living\s+communities)/i;

/** Contact display names only — match Python _COMMUNITY_PM_CONTACT_RE / _AMC_ONLY_RE */
const AMC_ONLY_RE = /^amc\.?$/i;
const COMMUNITY_PM_CONTACT_RE =
  /\b\w+\s+townhomes?\b|\b\w+\s+apartments\b|\b(?:[a-z0-9]+\s+){1,5}residential\b/i;
/** Match Python: brokerage-style names ending in Realty; X Management; lone Berkshire */
const BROKER_REALTY_CONTACT_RE = /(?:[a-z0-9.'&-]+\s+){2,}realty\b/i;
const PM_MANAGEMENT_NAME_RE = /\b[\w.'&-]+\s+management\b/i;
const PM_LEASING_NAME_RE = /\b[\w.'&-]+\s+leasing\b/i;
const BERKSHIRE_ONLY_RE = /^berkshire\.?$/i;
/** Match Python _COMPANY_SUFFIX_RE — e.g. "The Krenger Company" */
const COMPANY_SUFFIX_RE = /\b(?:the\s+)?[\w.'&-]{2,}\s+company\b/i;
/** Match Python _PROPERTIES_SUFFIX_RE — e.g. "Estia Properties" */
const PROPERTIES_SUFFIX_RE = /\b[\w.'&-]{2,}\s+properties\b/i;

const ROLE_ONLY_PM_LABELS = new Set([
  "leasing agent",
  "lease agent",
  "listing agent",
  "leasing office",
  "leasing specialist",
  "leasing consultant",
  "leasing professional",
  "property manager",
  "rental agent",
  "rental specialist",
]);

const PM_SUBSTRING_HINTS = [
  "cross street",
  "greystar",
  "blanton turner",
  "equity residential",
  "invitation homes",
  "lincoln property",
  "morgan properties",
  "cortland",
  "avalonbay",
  "avalon bay",
  "mid-america apartment",
  "essex property",
  "camden property",
  "bell partners",
  "bozzuto",
  "related rentals",
  "related companies",
  "avenue 5",
  "westland townhomes",
  "apartment management consultants",
  "cushman",
  "wakefield",
  "luxury living",
  "berkshire hathaway",
  "bhhs",
  "coldwell banker",
  "century 21",
  "sotheby",
  "dlc management",
  "prairie hills",
  "hudson leasing",
  "dinerstein",
  "willow bridge",
  "bridge property",
  "cagan",
  "rpm living",
  "kiser",
  "air communities",
  "mac property",
  "stellar performance",
  "drg",
  "downtown resource",
  "dmc management",
  "realty managment", // Hotpads typo for "management" on lister names
] as const;

/** Zillow FRBO only — match Python _FRBO_PM_EXTRA_HINTS + _PROPERTIES_SUFFIX_RE */
const ZILLOW_FRBO_EXTRA_HINTS = ["group fox", "estia"] as const;

/** Transit / housing authority — match Python is_quasi_public_entity_contact (contact line only) */
const QUASI_PUBLIC_ENTITY_RE =
  /\btransit\s+author(?:ity)?\b|\bhousing\s+authority\b|\bport\s+authority\b|\bmunicipal\b/i;

/** Zillow HDP copy that implies professionally managed despite a person-shaped displayName. */
const ZILLOW_MANAGED_DESCRIPTION_HINTS = [
  "contact manager",
  "contact property manager",
  "contact the manager",
  "on-site management",
  "onsite management",
  "on-site management and maintenance",
  "speak with a leasing",
  "speak to a leasing",
  "learn more about the building",
  "source: zillow rentals",
  "source: zillow rental manager",
  "request to apply",
] as const;

/** Match Python _NEGATED_FEES_MAY_APPLY_RE — avoid hiding rows with "No application fees may apply" */
const NEGATED_FEES_MAY_APPLY_RE =
  /\bno\s+(?:(?:application|additional)\s+)?fees\s+may\s+apply\b/i;
const PET_FEES_MAY_APPLY_RE = /\bpet\s+fees\s+may\s+apply\b/i;

export function zillowFrboDescriptionImpliesManaged(description: string | null | undefined): boolean {
  if (!description || typeof description !== "string") return false;
  const low = description.toLowerCase().replace(/\s+/g, " ");
  if (ZILLOW_MANAGED_DESCRIPTION_HINTS.some((h) => low.includes(h))) return true;
  if (!low.includes("fees may apply")) return false;
  if (NEGATED_FEES_MAY_APPLY_RE.test(description)) return false;
  if (PET_FEES_MAY_APPLY_RE.test(description)) return false;
  return true;
}

/** Match Python _zillow_frbo_managed_price_cue — Zillow managed tiers use +/mo or “fees may apply”. */
export function zillowFrboPriceImpliesManaged(price: string | null | undefined): boolean {
  if (!price || typeof price !== "string") return false;
  const t = price.trim();
  if (/\$\s*[\d,]+\s*\+/.test(t)) return true;
  const tld = t.toLowerCase().replace(/\s+/g, "").replace(/\$/g, "");
  if (/[\d,]+\+\/mo/.test(tld)) return true;
  if (t.toLowerCase().replace(/\s+/g, " ").includes("fees may apply")) return true;
  // Hotpads/building cards: "$1,807 - $2,280"
  if (/\$\s*[\d,]+\s*[-–]\s*\$?\s*[\d,]+/.test(t)) return true;
  return false;
}

/** Match Python _zillow_frbo_managed_unit_token_in_address — internal unit ids (#Ca1aaa2d9, #0B-1Ba). */
export function zillowFrboAddressImpliesManagedUnitToken(address: string | null | undefined): boolean {
  if (!address || address.length < 8) return false;
  const re = /#\s*([A-Za-z0-9-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(address)) !== null) {
    const seg = m[1].replace(/[^A-Za-z0-9]/g, "");
    if (seg.length < 5) continue;
    const hasLetter = /[a-z]/i.test(seg);
    const hasDigit = /\d/.test(seg);
    if (hasLetter && hasDigit) return true;
  }
  return false;
}

export function isQuasiPublicEntityDisplayName(ownerName: string | null | undefined): boolean {
  if (!ownerName || typeof ownerName !== "string") return false;
  const t = ownerName.trim();
  if (t.length < 3) return false;
  if (QUASI_PUBLIC_ENTITY_RE.test(t)) return true;
  const low = t.toLowerCase().replace(/\s+/g, " ");
  return low.includes("transit author");
}

export function isCorporateLandlordDisplayName(
  ownerName: string | null | undefined,
  strictZillowFrboContact = false,
): boolean {
  if (!ownerName || typeof ownerName !== "string") return false;
  const t = ownerName.trim();
  if (t.length < 2) return false;
  /** Split interior caps so "propertyManagement" matches PM heuristics (sync with Python _split_camel_boundaries). */
  const scan = t.replace(/([a-z])([A-Z])/g, "$1 $2");
  const norm = t.toLowerCase().replace(/\s+/g, " ");
  const scanNorm = scan.toLowerCase().replace(/\s+/g, " ");
  if (ROLE_ONLY_PM_LABELS.has(norm)) return true;
  if (/\b(lease|leasing)\s+agent\b/i.test(scan)) return true;
  if (/\b(?:real\s+estate|rental)\s+agent\b/i.test(scan)) return true;
  if (CORP_ENTITY_RE.test(scan)) return true;
  if (t.toLowerCase().replace(/\s+/g, "").includes("propco")) return true;
  const trimmed = t.trim();
  if (AMC_ONLY_RE.test(trimmed)) return true;
  if (BERKSHIRE_ONLY_RE.test(trimmed)) return true;
  if (BROKER_REALTY_CONTACT_RE.test(scan)) return true;
  if (PM_MANAGEMENT_NAME_RE.test(scan)) return true;
  if (PM_LEASING_NAME_RE.test(scan)) return true;
  if (COMPANY_SUFFIX_RE.test(scan)) return true;
  if (COMMUNITY_PM_CONTACT_RE.test(scan)) return true;
  if (INSTITUTIONAL_NAME_RE.test(scan)) return true;
  if (PM_SUBSTRING_HINTS.some((h) => scanNorm.includes(h))) return true;
  if (strictZillowFrboContact) {
    if (PROPERTIES_SUFFIX_RE.test(scan)) return true;
    if (ZILLOW_FRBO_EXTRA_HINTS.some((h) => scanNorm.includes(h))) return true;
  }
  return false;
}

/**
 * Hotpads building / community hub: `/b/pad`, `/building/…`, or a single slug before `/pad`
 * (e.g. `…/stevens-square-apartments-…/pad`). Unit listings use `…/{slug}/{n}/pad` with numeric `n`.
 */
export function hotpadsListingUrlLooksBuildingHub(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const raw = url.trim();
  const low = raw.toLowerCase();
  if (!low.includes("hotpads.com")) return false;
  if (low.includes("/b/pad") || low.includes("/building/")) return true;
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const path = new URL(normalized).pathname.replace(/\/+$/, "").toLowerCase();
    if (!path.endsWith("/pad")) return false;
    const inner = path.slice(0, -"/pad".length).replace(/^\/+|\/+$/g, "");
    if (!inner) return false;
    const parts = inner.split("/").filter(Boolean);
    if (parts.length === 1) return true;
    if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1]!)) return false;
  } catch {
    return false;
  }
  return false;
}

/**
 * Known relay inboxes (strict by-owner table/API). Omit support@hotpads.com: Hotpads uses it for
 * masked owner contact on most listings, not only PM — treating it as placeholder hid every row.
 */
const PM_RELAY_PLACEHOLDER_EMAILS = new Set([
  "noreply@zillow.com",
  "contact@trulia.com",
  "help@apartments.com",
]);

export function rentalListingEmailIsPlatformPlaceholder(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const e = email.trim().toLowerCase();
  return e.length > 0 && PM_RELAY_PLACEHOLDER_EMAILS.has(e);
}
