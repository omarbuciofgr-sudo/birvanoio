import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { skipTraceApi } from '@/lib/api/skipTrace';
import {
  scraperBackendApi,
  buildHotpadsUrl,
  buildApartmentsFrboUrl,
  buildFsboSearchUrl,
  buildTruliaUrl,
  buildZillowFsboUrl,
  buildZillowFrboRentalsUrl,
  isZillowFrboUsCountryLocation,
  type LastResultFetchOptions,
} from '@/lib/api/scraperBackend';
import { cityNeedsLiveScrape, isBackendRealEstatePlatform } from '@/lib/realEstateBackend';
import {
  RE_USER_MESSAGES,
  emptyReasonUserMessage,
  friendlyApiError,
  listingMatchesSearchSession,
  normalizeLocationClient,
} from '@/lib/realEstateSearch';
import {
  hotpadsListingUrlLooksBuildingHub,
  isCorporateLandlordDisplayName,
  isQuasiPublicEntityDisplayName,
  rentalListingEmailIsPlatformPlaceholder,
  zillowFrboAddressImpliesManagedUnitToken,
  truliaDescriptionImpliesAgentOrMls,
  zillowFrboDescriptionImpliesManaged,
  zillowFrboPriceImpliesManaged,
} from '@/lib/realEstateOwnerFilter';

/** Resolve city + state from API or client; tolerates brief 400s while typing. */
async function resolveSearchLocation(raw: string): Promise<ReturnType<typeof normalizeLocationClient>> {
  const trimmed = raw.trim().replace(/,\s*$/, '').trim();
  const fromApi = await scraperBackendApi.normalizeLocation(trimmed);
  if (fromApi.success && fromApi.search_location) {
    return {
      success: true,
      search_city: fromApi.search_city ?? undefined,
      search_state: fromApi.search_state ?? undefined,
      search_location: fromApi.search_location,
      city_slug: fromApi.city_slug ?? undefined,
      city_state_slug: fromApi.city_state_slug ?? undefined,
      valid: true,
    };
  }
  return normalizeLocationClient(trimmed);
}

function filterListingsForSearchLocation(listings: any[], searchLocation: string): any[] {
  const loc = searchLocation.trim();
  if (!loc) return listings;
  return listings.filter((l) =>
    listingMatchesSearchSession(
      {
        search_city: l.search_city,
        search_state: l.search_state,
        address: l.address,
        listing_url: l.listing_url,
        source_url: l.source_url,
      },
      loc,
    ),
  );
}
import { supabase } from '@/integrations/supabase/client';
import { BrivanoLens } from '@/components/scraper/ProspectSearchDialog';
import { GoogleJobsScraper } from '@/components/scraper/GoogleJobsScraper';
import { 
  Search, 
  Loader2, 
  ExternalLink, 
  Copy, 
  Download,
  UserPlus,
  Check,
  Home,
  Building,
  Building2,
  Target,
  Phone as PhoneIcon,
  Mail as MailIcon,
  MailCheck,
  Save,
  RotateCw,
  MapPin,
  Send,
  Bot,
  Sparkles,
  FileSpreadsheet,
  FileUp,
  TrendingUp,
  Users,
  UserSearch,
  Cpu,
  Globe,
  ListFilter,
  ClipboardList,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { lazy, Suspense } from 'react';
const ListingsMap = lazy(() => import('@/components/scraper/ListingsMap'));
import { TechnographicsSearch } from '@/components/scout/TechnographicsSearch';
import { LookalikeSearch } from '@/components/scout/LookalikeSearch';
import { DomainResolver } from '@/components/scout/DomainResolver';
import { DynamicLists } from '@/components/scout/DynamicLists';
import { BulkEmailFinder } from '@/components/scout/BulkEmailFinder';
import { addressMatchesSearch } from '@/components/scraper/ListingsMap';
import { PLATFORM_CONFIG, resolveListingPlatformMark } from '@/lib/platformLogos';
import { PlatformMark } from '@/components/scraper/PlatformMark';
import {
  PLANNER_FILTER_CATALOG,
} from '@/lib/planner/catalog';
import {
  buildApplyPayloadFromAnswers,
  buildCollectPlannerUiPayload,
  buildOptionalPromptPlannerUiPayload,
  buildReviewPlannerUiPayload,
  commitAnswer,
  createInitialPlannerHostState,
  getCurrentFieldId,
  getNextPlannerQuestion,
  getPlannerField,
  goBackOneStep,
  goToFieldForEdit,
  looksLikeOffTopicAnswer,
  normalizeAnswerForField,
  runPlannerValidation,
  skipOptionalField,
  startPlannerFlow,
  transitionOptionalPromptToCollectingOptional,
  transitionOptionalPromptToReview,
  transitionReviewToOptionalPrompt,
  validatePlannerAnswerForPhase,
  type PlannerHostState,
} from '@/lib/planner/plannerFlow';
import {
  parsePlannerUiBlock,
  stripPlannerUiFence,
  type PlannerUiPayload,
} from '@/lib/planner/plannerUi';
import { validateScraper } from '@/config/scraperValidation';
import { defaultFilters as defaultProspectFilters } from '@/components/prospect-search/constants';
import { defaultPeopleFilters } from '@/components/prospect-search/PeopleFilters';
import { defaultJobFilters } from '@/components/prospect-search/JobFilters';

function ListingSourcePlatformMark({
  sourcePlatform,
  sourceUrl,
}: {
  sourcePlatform: string;
  sourceUrl?: string | null;
}) {
  const mark = resolveListingPlatformMark(sourcePlatform, sourceUrl);
  return (
    <PlatformMark
      logoSrc={mark.logo}
      fallbackLetter={mark.fallback}
      title={mark.title || sourcePlatform}
      size="sm"
    />
  );
}

/** Parse address from Zillow homedetails URL slug (e.g. .../homedetails/623-Russell-Ave-N-Minneapolis-MN-55411/1887741_zpid/ → "623 Russell Ave N Minneapolis MN 55411"). Works for any city. */
function addressFromZillowUrl(url: string | null | undefined): string | null {
  if (!url?.includes?.('/homedetails/')) return null;
  const match = url.match(/\/homedetails\/([^/]+)\/\d+_zpid/);
  return match ? match[1].replace(/-/g, ' ').trim() : null;
}
/** Parse address from FSBO.com listing URL slug (e.g. .../listing/123-Main-St-Austin-TX-78701/ → "123 Main St Austin TX 78701"). Works for any city. */
function addressFromFsboUrl(url: string | null | undefined): string | null {
  if (!url?.includes?.('forsalebyowner.com') || !url?.includes?.('/listing/')) return null;
  const match = url.match(/\/listing\/([^/]+)/);
  return match ? match[1].replace(/-/g, ' ').trim() : null;
}

function mapZillowFsboBackendRow(l: any) {
  const url = l.listing_url || '';
  const address = (l.address || '').trim() || addressFromZillowUrl(url) || undefined;
  return {
    address,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    price: l.price,
    owner_name: l.owner_name,
    owner_phone: l.owner_phone,
    listing_url: url,
    source_url: url,
    source_platform: 'zillow_fsbo',
    listing_type: 'sale',
    square_feet: l.square_feet,
    days_on_market: (l as { days_on_market?: string; days_on_zillow?: string }).days_on_market ?? (l as { days_on_zillow?: string }).days_on_zillow,
  };
}

function mapZillowFrboBackendRow(l: any) {
  const url = (l.listing_url || l.url || '').trim();
  const address = (l.address || '').trim() || addressFromZillowUrl(url) || undefined;
  return {
    address,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    price: l.price,
    owner_name: l.owner_name,
    owner_phone: l.owner_phone,
    description: typeof l.description === 'string' ? l.description : '',
    listing_url: url,
    source_url: url,
    source_platform: 'zillow_frbo',
    listing_type: 'rent',
    square_feet: l.square_feet,
    days_on_market: (l as { days_on_market?: string; days_on_zillow?: string }).days_on_market ?? (l as { days_on_zillow?: string }).days_on_zillow,
  };
}

/** "chicago il" → "Chicago, IL" for appending to street-only lines. */
function formatCityStateLineFromSlug(cs: string | null): string | null {
  if (!cs?.trim()) return null;
  const parts = cs.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const st = parts[parts.length - 1].toUpperCase();
  if (st.length !== 2) return null;
  const city = parts
    .slice(0, -1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return `${city}, ${st}`;
}

/** Collapse "4225 Emerson Ave N Unit 4225 Emerson Ave. N" (Apartments.com noise) → first clause. */
function dedupeRedundantUnitStreetLine(streetPart: string): string {
  const m = streetPart.match(/^(.+?)\s+Unit\s+(.+)$/i);
  if (!m) return streetPart;
  const a = m[1].trim();
  const b = m[2].trim();
  const norm = (x: string) => x.replace(/[\s.#]+/g, '').toLowerCase();
  const na = norm(a);
  const nb = norm(b);
  const a0 = a.split(/\s+/)[0] || '';
  const b0 = b.split(/\s+/)[0] || '';
  const sameLead = /^\d+$/.test(a0) && a0 === b0;
  const bStartsA = na.length > 0 && nb.startsWith(na.slice(0, Math.min(14, na.length)));
  if (sameLead || bStartsA || na === nb) return a;
  return streetPart;
}

function normalizeRentalAddressString(full: string): string {
  const parts = full.split(',').map((p) => p.trim());
  if (parts.length === 0 || !parts[0]) return full.trim();
  parts[0] = dedupeRedundantUnitStreetLine(parts[0]);
  return parts.join(', ');
}

/**
 * Apartments.com rows sometimes have empty `address` in Supabase while JSON-LD `title` still
 * contains a street line. Without this, `addressForSkipTrace` is empty and Skip Trace stays disabled.
 */
function rentalAddressFallbackFromListingMetadata(listing: {
  source_platform?: string | null;
  title?: string | null;
}): string {
  const sp = (listing.source_platform || '').toLowerCase();
  if (!sp.includes('apartments')) return '';
  const t = (listing.title || '').trim();
  if (!t || t.length > 180) return '';
  if (!/\d/.test(t)) return '';
  if (/^\s*from\s+\$/i.test(t)) return '';
  const leadingStreetNum = /^\d+[a-zA-Z]?\s+/.test(t);
  const looksLikeFullLine = /,\s*[A-Za-z]/.test(t);
  const streetWord =
    /\d+[a-zA-Z.-]?\s+.+\b(?:st|street|ave|avenue|rd|road|dr|drive|blvd|blvd\.|ln|lane|way|ct|court)\b/i.test(
      t,
    );
  if (leadingStreetNum || (looksLikeFullLine && t.length >= 10) || streetWord) return t;
  return '';
}

/** Unusable for skip trace / display (e.g. "MN, 55414" or city-only). */
function rentalAddressIsGarbage(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (/^[A-Za-z]{2}\s*,\s*\d{5}(-\d{4})?\s*$/i.test(t)) return true;
  const first = t.split(',')[0].trim();
  if (first && !/\d/.test(first)) return true;
  return false;
}

/** Base URL for parsing relative listing paths (city-state slug) in address filters. */
function listingOriginForCitySlugParse(listing: { source_platform?: string | null }): string {
  const p = (listing.source_platform || '').toLowerCase();
  if (p.includes('trulia')) return 'https://www.trulia.com';
  if (p.includes('apartments')) return 'https://www.apartments.com';
  return 'https://hotpads.com';
}

function rebuildGarbageRentalAddressFromUrl(url: string, prior: string, originFallback?: string): string {
  const zip = prior.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1];
  const line = formatCityStateLineFromSlug(cityStateFromListingUrl(url, originFallback));
  if (!line) return prior;
  const [city, st] = line.split(',').map((x) => x.trim());
  if (zip) return `${city}, ${st} ${zip}`;
  return `${city}, ${st}`;
}

function getNormalizedRentalAddressForListing(listing: {
  address?: string | null;
  listing_url?: string | null;
  source_url?: string | null;
  source_platform?: string | null;
  title?: string | null;
  description?: string | null;
}): string {
  const platform = (listing.source_platform || '').toLowerCase();
  const rental =
    platform.includes('apartments') || platform.includes('hotpads') || platform.includes('trulia');
  if (!rental) return (listing.address || '').trim();
  let raw = (listing.address || '').trim();
  const url = (listing.listing_url || listing.source_url || '').trim();
  if (!raw) {
    const fromMeta = rentalAddressFallbackFromListingMetadata(listing);
    if (fromMeta) raw = fromMeta;
  }
  if (!raw && platform.includes('apartments')) {
    const d = typeof listing.description === 'string' ? listing.description.trim() : '';
    if (d && d.length <= 400 && /\d/.test(d)) {
      const first = d.split(/\n|\.(?:\s|$)/)[0].trim();
      if (
        first.length >= 8 &&
        (/,/.test(first) || /\b(?:st|street|ave|avenue|rd|road|dr|drive|blvd|ln|lane|way|ct|court)\b/i.test(first))
      ) {
        raw = first;
      }
    }
  }
  if (!raw) return '';
  raw = normalizeRentalAddressString(raw);
  if (rentalAddressIsGarbage(raw) && url) {
    const rebuilt = rebuildGarbageRentalAddressFromUrl(url, raw, listingOriginForCitySlugParse(listing));
    if (rebuilt) raw = rebuilt;
  }
  return raw;
}

/** Remove Zillow unit tokens (``#354-3W``, hex ids) so skip-trace street matches assessor / BatchData. */
function sanitizeAddressLineForSkipTrace(line: string): string {
  let s = line.replace(/\s+#\s*[0-9a-f]{8,}\b/gi, ' ');
  s = s.replace(/\s+#\S+/g, ' ');
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Prefer listing.address; FSBO.com can use URL slug. For Apartments/Hotpads/Trulia, normalize bad/duplicate
 * address lines so BatchData gets the same quality as other scrapers.
 */
function addressForSkipTrace(listing: {
  address?: string | null;
  listing_url?: string | null;
  source_url?: string | null;
  source_platform?: string | null;
}): string {
  const platform = (listing.source_platform || '').toLowerCase();
  const url = (listing.listing_url || listing.source_url || '').trim();
  const rentalSite =
    platform.includes('apartments') || platform.includes('hotpads') || platform.includes('trulia');

  let raw = rentalSite ? getNormalizedRentalAddressForListing(listing) : (listing.address || '').trim();

  if (!raw && platform === 'fsbo') {
    return addressFromFsboUrl(url) || '';
  }

  if (platform.includes('zillow')) {
    raw = sanitizeAddressLineForSkipTrace(raw);
  }

  if (raw && rentalSite) {
    const hasZip = /\b\d{5}(-\d{4})?\b/.test(raw);
    // "Street, City, ST" or "Street, City, ST 606xx"
    const hasCityAndState = /,\s*[^,]{2,},\s*[A-Za-z]{2}\b/.test(raw);
    if (!hasZip && !hasCityAndState) {
      const tail = formatCityStateLineFromSlug(cityStateFromListingUrl(url, listingOriginForCitySlugParse(listing)));
      if (tail) {
        const [cityPart, stPart] = tail.split(',').map((s) => s.trim());
        const hasState = stPart && new RegExp(`\\b${stPart}\\b`).test(raw);
        const mentionsCity =
          cityPart.length >= 3 && raw.toLowerCase().includes(cityPart.toLowerCase());
        if (!hasState && mentionsCity) {
          raw = `${raw}, ${stPart}`;
        } else if (!mentionsCity) {
          raw = `${raw}, ${tail}`;
        }
      }
    }
  }

  return raw;
}
/** Try to get city/state from Hotpads, Trulia, Apartments URL paths (e.g. .../chicago-il/... → "chicago il") for city filter when backend omits address. */
function cityStateFromListingUrl(url: string | null | undefined, originFallback?: string): string | null {
  if (!url?.trim()) return null;
  const s = url.trim();
  try {
    const u = /^https?:\/\//i.test(s) ? new URL(s) : new URL(s, originFallback || 'https://hotpads.com');
    const path = u.pathname.toLowerCase();
    // Match segments like /chicago-il/ or /chicago_il/
    const citySt = path.match(/\/([a-z0-9]+)[-_]([a-z]{2})(?:\/|$)/);
    if (citySt) return `${citySt[1]} ${citySt[2]}`;
    const stateCity = path.match(/\/([a-z]{2})\/([a-z0-9-]+)(?:\/|$)/);
    if (stateCity) return `${stateCity[2].replace(/-/g, ' ')} ${stateCity[1]}`;
  } catch { /* ignore */ }
  return null;
}
/** Derive display address: use listing.address, or parse URL for Zillow/FSBO, or city-state from URL for other scrapers. Used for city filter on all platforms. */
function listingDisplayAddress(listing: { address?: string | null; listing_url?: string | null; source_url?: string | null; source_platform?: string | null }): string {
  const platform = (listing.source_platform || '').toLowerCase();
  const rental =
    platform.includes('apartments') || platform.includes('hotpads') || platform.includes('trulia');
  if (rental) {
    const n = getNormalizedRentalAddressForListing(listing);
    if (n) return n;
  } else {
    const addr = (listing.address || '').trim();
    if (addr) return addr;
  }
  const url = (listing.listing_url || listing.source_url || '').trim();
  if (listing.source_platform === 'fsbo' && url) {
    const fromUrl = addressFromFsboUrl(url);
    if (fromUrl) return fromUrl;
  }
  const isZillow = (listing.source_platform === 'zillow_fsbo' || listing.source_platform === 'zillow_frbo') || /zillow\.com/i.test(url);
  if (isZillow && url) {
    const fromUrl = addressFromZillowUrl(url);
    if (fromUrl) return fromUrl;
  }
  // Hotpads, Trulia, Apartments: use city-state from URL for filtering when address missing
  const fromUrl = cityStateFromListingUrl(url, listingOriginForCitySlugParse(listing));
  if (fromUrl) return fromUrl;
  return 'Address not available';
}

/** Get URL for "View listing" button: use direct listing URL if present, else a platform search fallback so the button always shows. */
function getListingViewUrl(listing: { address?: string | null; listing_url?: string | null; source_url?: string | null; source_platform?: string | null; [k: string]: any }): string | null {
  const direct = (listing.source_url || listing.listing_url || listing.url || '').trim();
  if (direct && direct !== '#') return direct;
  const platform = (listing.source_platform || '').toLowerCase();
  const addr = (listing.address || listingDisplayAddress(listing) || '').trim();
  const city = listingCity(addr) || '';
  const stateMatch = addr.match(/\b([A-Za-z]{2})\s*(?:\d{5})?\s*$/);
  const state = stateMatch ? stateMatch[1].toLowerCase() : '';
  const cityStateSlug = city && state ? `${city.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}-${state}` : '';
  if (platform.includes('zillow')) {
    if (cityStateSlug) return `https://www.zillow.com/${state}/${city.replace(/\s+/g, '-').toLowerCase()}/`;
    return 'https://www.zillow.com/';
  }
  if (platform.includes('hotpads')) return cityStateSlug ? `https://hotpads.com/${cityStateSlug}/apartments-for-rent` : 'https://hotpads.com/';
  if (platform.includes('trulia')) return cityStateSlug ? `https://www.trulia.com/${state}/${city.replace(/\s+/g, '-').toLowerCase()}/` : 'https://www.trulia.com/';
  
  if (platform.includes('apartments')) return cityStateSlug ? `https://www.apartments.com/${cityStateSlug}/` : 'https://www.apartments.com/';
  if (platform.includes('fsbo')) return 'https://www.forsalebyowner.com/';
  return null;
}

/** Parse city from full address string (e.g. "559 Carlton Ave, Brooklyn, NY 11238" -> "Brooklyn"). */
function listingCity(displayAddress: string): string | null {
  const a = (displayAddress || '').trim();
  if (!a) return null;
  const parts = a.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    if (/\d/.test(first)) return parts[1] || null;
    return first || null;
  }
  // No comma: try "Street City ST Zip" – state is 2-letter, optionally followed by 5-digit zip
  const stateZip = a.match(/\b([A-Z]{2})\s*(?:\d{5}(-\d{4})?)?\s*$/i);
  if (stateZip) {
    const before = a.slice(0, stateZip.index).trim();
    const tokens = before.split(/\s+/);
    if (tokens.length >= 2) return tokens[tokens.length - 1];
  }
  return null;
}

/** Shown when Apartments.com has no card contact and property skip-trace returned no person — neutral for clients. */
const APARTMENTS_SKIP_TRACE_NO_MATCH_HINT =
  'No owner or listing contact was found for this address. That is common for Apartments.com rentals. Use View listing to reach the poster, or try another unit.';

function skipTraceHasUsefulContact(data: {
  phones?: { number?: string }[];
  emails?: { address?: string }[];
  fullName?: string | null;
} | undefined): boolean {
  if (!data) return false;
  const phone = data.phones?.[0]?.number;
  if (phone && String(phone).replace(/\D/g, '').length >= 10) return true;
  if (data.emails?.[0]?.address) return true;
  if (data.fullName && String(data.fullName).trim().length > 2) return true;
  return false;
}

type SkipTraceDataShape = {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  phones: { number: string; type: string }[];
  emails: { address: string }[];
  confidence?: number;
};

/**
 * Apartments.com only: BatchData property skip-trace often has no person for rental units.
 * When the scrape already captured manager/phone, treat that as the skip-trace outcome so the button succeeds.
 */
function apartmentsComSkipDataFromListing(listing: {
  source_platform?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
}): SkipTraceDataShape | undefined {
  const sp = (listing.source_platform || '').toLowerCase();
  if (sp !== 'apartments') return undefined;
  const name = (listing.owner_name || '').trim();
  const phoneRaw = (listing.owner_phone || '').trim();
  const email = (listing.owner_email || '').trim();
  const digits = phoneRaw.replace(/\D/g, '');
  const phones = digits.length >= 10 ? [{ number: phoneRaw, type: 'property_contact' }] : [];
  const emails = email ? [{ address: email }] : [];
  const draft: SkipTraceDataShape = {
    fullName: name || null,
    firstName: null,
    lastName: null,
    phones,
    emails,
    confidence: 38,
  };
  if (!skipTraceHasUsefulContact(draft)) return undefined;
  return draft;
}

function mergeSkipTraceResultWithApartmentsFallback(
  listing: any,
  result: { data?: SkipTraceDataShape; success?: boolean },
): { data: SkipTraceDataShape; fromApartmentsListing: boolean } | undefined {
  let data = result.data;
  if (skipTraceHasUsefulContact(data)) {
    return { data: data!, fromApartmentsListing: false };
  }
  const alt = apartmentsComSkipDataFromListing(listing);
  if (alt) return { data: alt, fromApartmentsListing: true };
  return undefined;
}

/** First scraped Zillow/card contact — used when skip trace returns an assessor name that is not a private landlord. */
function withScrapedListingContactSeed(listing: any): any {
  const n = (listing.owner_name || '').trim();
  if (!n || listing.scraped_listing_contact_name) return listing;
  return { ...listing, scraped_listing_contact_name: n };
}

function withScrapedListingContactSeeds(listings: any[]): any[] {
  return listings.map(withScrapedListingContactSeed);
}

/**
 * BatchData returns parcel/title owners (e.g. CHICAGO TRANSIT AUTHOR). For by-owner table visibility,
 * prefer the original listing contact when that assessor name is quasi-public or FRBO-corporate.
 */
function ownerNameForByOwnerTableFilter(listing: {
  owner_name?: string | null;
  scraped_listing_contact_name?: string | null;
  skip_trace_assessor_name?: string | null;
  skip_trace_status?: string;
  source_platform?: string | null;
}): string {
  const assessor = (listing.skip_trace_assessor_name || '').trim();
  const strictFrbo = (listing.source_platform || '').toLowerCase() === 'zillow_frbo';
  if (
    listing.skip_trace_status === 'success' &&
    assessor &&
    (isQuasiPublicEntityDisplayName(assessor) ||
      (strictFrbo && isCorporateLandlordDisplayName(assessor, true)))
  ) {
    const kept = (listing.scraped_listing_contact_name || '').trim();
    if (kept) return kept;
  }
  return (listing.owner_name || '').trim();
}

function buildListingAfterSkipTrace(
  listing: any,
  data: SkipTraceDataShape,
  sourcePlatformLower: string,
  providers: string[],
): any {
  const traceName = (data.fullName && String(data.fullName).trim()) || '';
  const listContact =
    (listing.scraped_listing_contact_name || listing.owner_name || '').trim();
  const strictFrbo = sourcePlatformLower === 'zillow_frbo';
  const badAssessor =
    !!traceName &&
    (isQuasiPublicEntityDisplayName(traceName) ||
      (strictFrbo && isCorporateLandlordDisplayName(traceName, true)));
  const owner_name = badAssessor ? listContact || traceName : traceName || listContact;
  return {
    ...listing,
    scraped_listing_contact_name: listing.scraped_listing_contact_name || listContact || undefined,
    skip_trace_assessor_name: traceName || undefined,
    owner_name,
    owner_phone: data.phones?.[0]?.number || listing.owner_phone,
    owner_email: data.emails?.[0]?.address || listing.owner_email,
    all_phones: data.phones,
    all_emails: data.emails,
    skip_trace_confidence: data.confidence,
    skip_trace_status: 'success' as const,
    enrichment_providers_used: providers,
  };
}

/** If scrape already returned manager phone/name/email, mark traced so Skip Trace is not required for every row. */
function withApartmentsListingContactPrefill(listing: any): any {
  const sp = (listing.source_platform || '').toLowerCase();
  if (sp !== 'apartments') return listing;
  if (listing.skip_trace_status === 'success' || listing.skip_trace_status === 'not_found') return listing;
  const alt = apartmentsComSkipDataFromListing(listing);
  if (!alt) return listing;
  return {
    ...listing,
    skip_trace_status: 'success' as const,
    skip_trace_confidence: alt.confidence ?? 38,
    enrichment_providers_used: ['apartments_listing_contact'],
    all_phones: listing.all_phones?.length ? listing.all_phones : alt.phones,
    all_emails: listing.all_emails?.length ? listing.all_emails : alt.emails,
  };
}

function formatUsPhoneForDisplay(raw: string): string {
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return String(raw).trim();
}

/** Stable key so backend refetches / progressive scrape polls can merge client skip-trace state onto the same row. */
function listingMergeKey(l: any): string {
  let u = (l.listing_url || l.source_url || '').trim().toLowerCase();
  if (u) {
    u = u.split('?')[0].replace(/\/+$/, '');
    return `u:${u}`;
  }
  const a = (l.address || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `a:${a}`;
}

/**
 * Full-array loads from the scraper API replace React state and would wipe skip-trace / saved flags.
 * Re-attach those fields from the previous in-memory row when URL (or address) matches.
 */
function mergeIncomingListingsWithPrevClientState(prev: any[], incoming: any[]): any[] {
  const prevByKey = new Map<string, any>();
  for (const p of prev) {
    prevByKey.set(listingMergeKey(p), p);
  }
  return incoming.map((row) => {
    const old = prevByKey.get(listingMergeKey(row));
    if (!old) return row;
    let out: any = { ...row };
    if (old.saved_to_db) out.saved_to_db = true;
    if (old.skip_trace_status === 'success') {
      out = {
        ...out,
        scraped_listing_contact_name: old.scraped_listing_contact_name || out.scraped_listing_contact_name,
        skip_trace_status: 'success' as const,
        skip_trace_assessor_name: old.skip_trace_assessor_name,
        skip_trace_confidence: old.skip_trace_confidence,
        enrichment_providers_used: old.enrichment_providers_used,
        owner_name: old.owner_name,
        owner_phone: old.owner_phone ?? out.owner_phone,
        owner_email: old.owner_email ?? out.owner_email,
        all_phones: old.all_phones?.length ? old.all_phones : out.all_phones,
        all_emails: old.all_emails?.length ? old.all_emails : out.all_emails,
      };
    } else if (old.skip_trace_status === 'not_found') {
      out.skip_trace_status = 'not_found' as const;
    }
    return out;
  });
}

/** Last `/last-result` PM strip stats (shown next to listing count). */
type ReLastBackendPmMeta = {
  total_stored: number;
  pm_rows_hidden: number;
  include_pm: boolean;
  returned: number;
};

function extractBackendPmMeta(
  result: { include_pm?: boolean; total_stored?: number; pm_rows_hidden?: number },
  returnedCount: number,
): ReLastBackendPmMeta | null {
  if (typeof result.total_stored !== 'number') return null;
  const include_pm = result.include_pm === true;
  const pm_rows_hidden =
    typeof result.pm_rows_hidden === 'number'
      ? result.pm_rows_hidden
      : include_pm
        ? 0
        : Math.max(0, result.total_stored - returnedCount);
  return {
    total_stored: result.total_stored,
    pm_rows_hidden: include_pm ? 0 : pm_rows_hidden,
    include_pm,
    returned: returnedCount,
  };
}

/**
 * By-owner table filter: hide PM/corporate display names.
 * Uses listing contact when skip trace stored a bad assessor name (e.g. CHICAGO TRANSIT AUTHOR) so the row does not disappear.
 */
function listingPassesByOwnerVisibility(listing: {
  owner_name?: string | null;
  owner_email?: string | null;
  scraped_listing_contact_name?: string | null;
  skip_trace_assessor_name?: string | null;
  skip_trace_status?: string;
  source_platform?: string | null;
  description?: string | null;
  address?: string | null;
  price?: string | null;
  hp_strict_signal?: string | null;
  listing_url?: string | null;
  source_url?: string | null;
  trulia_strict_signal?: string | null;
}) {
  const nameForFilter = ownerNameForByOwnerTableFilter(listing);
  if (isQuasiPublicEntityDisplayName(nameForFilter)) return false;
  const sp = (listing.source_platform || '').toLowerCase();
  // Trulia FSBO: same strict table rules as rental by-owner scrapers (description / price / corporate names).
  const strictRentalByOwner =
    sp === 'zillow_frbo' || sp === 'hotpads' || sp === 'apartments' || sp === 'trulia';
  if (strictRentalByOwner && sp === 'trulia') {
    const ts = (listing.trulia_strict_signal || '').trim().toLowerCase();
    if (ts === 'managed') return false;
    if (ts === 'owner') {
      if (isCorporateLandlordDisplayName(nameForFilter, true)) return false;
      if (truliaDescriptionImpliesAgentOrMls(listing.description)) return false;
      if (nameForFilter.includes(' | ')) {
        const right = nameForFilter.split('|').pop()!.trim();
        if (
          right.length > 2 &&
          /\b(llc|inc\.?|corp\.?|ltd\.?|realty|real\s+estate|properties|group|brokerage|realtors?|associates)\b/i.test(
            right,
          )
        ) {
          return false;
        }
      }
      return true;
    }
    // unknown / missing: "Name | Brokerage" from scraper merge
    if (nameForFilter.includes(' | ')) {
      const right = nameForFilter.split('|').pop()!.trim();
      if (
        right.length > 2 &&
        /\b(llc|inc\.?|corp\.?|ltd\.?|realty|real\s+estate|properties|group|brokerage|realtors?|associates)\b/i.test(
          right,
        )
      ) {
        return false;
      }
    }
    // fall through to description & corporate heuristics
  }
  if (strictRentalByOwner && sp === 'hotpads') {
    const hubUrl = listing.listing_url || listing.source_url;
    if (hotpadsListingUrlLooksBuildingHub(hubUrl)) return false;
    const hp = (listing.hp_strict_signal || '').trim().toLowerCase();
    if (hp === 'managed') return false;
    // Hotpads can flag by-owner on LLC landlords; still apply corporate/PM name rules below.
    if (hp === 'owner' && !isCorporateLandlordDisplayName(nameForFilter, true)) return true;
    // support@hotpads.com is normal for masked FRBO — do not hide on email alone (would show 0 rows).
  }
  if (strictRentalByOwner && rentalListingEmailIsPlatformPlaceholder(listing.owner_email)) return false;
  if (strictRentalByOwner) {
    if (zillowFrboDescriptionImpliesManaged(listing.description)) return false;
    if (sp === 'trulia' && truliaDescriptionImpliesAgentOrMls(listing.description)) return false;
    if (zillowFrboPriceImpliesManaged(listing.price)) return false;
    if (zillowFrboAddressImpliesManagedUnitToken(listing.address)) return false;
  }
  return !isCorporateLandlordDisplayName(nameForFilter, strictRentalByOwner);
}

const HOTPADS_MASK_EMAIL = 'support@hotpads.com';

/**
 * Hotpads by-owner table only: rank rows so the top of the list is not identical to Include PM
 * (which follows API newest-first). Real emails and Hotpads owner signal rise above masked support@ rows.
 */
function hotpadsByOwnerDisplaySortRank(listing: {
  owner_email?: string | null;
  hp_strict_signal?: string | null;
}): number {
  const em = (listing.owner_email || '').trim().toLowerCase();
  const hasRealEmail =
    em.length > 0 &&
    em !== HOTPADS_MASK_EMAIL &&
    !rentalListingEmailIsPlatformPlaceholder(listing.owner_email);
  if (hasRealEmail) return 0;
  if ((listing.hp_strict_signal || '').trim().toLowerCase() === 'owner') return 1;
  return 2;
}

function withStoredSearchFields(src: { search_city?: string; search_state?: string; search_location?: string }, mapped: Record<string, unknown>) {
  const out = { ...mapped };
  if (src.search_city) out.search_city = src.search_city;
  if (src.search_state) out.search_state = src.search_state;
  if (src.search_location) out.search_location = src.search_location;
  return out;
}

/** Map Flask /api/.../last-result rows to the same listing shape as after a scrape (used for refresh). */
function mapBackendListingsForPlatform(platform: string, listings: any[]): any[] {
  const list = listings || [];
  let mapped: any[] = [];
  switch (platform) {
    case 'hotpads':
      mapped = list.map((l) => withStoredSearchFields(l, {
        address: l.address,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        price: l.price,
        owner_name: l.owner_name,
        owner_phone: l.owner_phone,
        owner_email: l.owner_email,
        listing_url: l.listing_url,
        source_url: l.listing_url,
        source_platform: 'hotpads',
        listing_type: 'rent',
        square_feet: l.square_feet,
        days_on_market: l.days_on_market ?? l.days_on_zillow,
        hp_strict_signal: l.hp_strict_signal ?? null,
      }));
      break;
    case 'trulia':
      mapped = list.map((l) => withStoredSearchFields(l, {
        address: l.address,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        price: l.price,
        owner_name: l.owner_name,
        owner_phone: l.owner_phone,
        owner_email: l.owner_email,
        description: typeof l.description === 'string' ? l.description : '',
        listing_url: l.listing_url,
        source_url: l.listing_url,
        source_platform: 'trulia',
        listing_type: 'sale',
        square_feet: l.square_feet,
        days_on_market: l.days_on_market ?? l.days_on_zillow,
        trulia_strict_signal: l.trulia_strict_signal ?? null,
      }));
      break;
    case 'zillow':
      mapped = list.map((l) => {
        const url = l.listing_url || '';
        const address = (l.address || '').trim() || addressFromZillowUrl(url) || undefined;
        return withStoredSearchFields(l, {
          address,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          price: l.price,
          owner_name: l.owner_name,
          owner_phone: l.owner_phone,
          listing_url: url,
          source_url: url,
          source_platform: 'zillow_fsbo',
          listing_type: 'sale',
          square_feet: l.square_feet,
          days_on_market: l.days_on_market ?? l.days_on_zillow,
        });
      });
      break;
    case 'zillow_frbo':
      mapped = list.map((l) => {
        const url = l.listing_url || '';
        const address = (l.address || '').trim() || addressFromZillowUrl(url) || undefined;
        return withStoredSearchFields(l, {
          address,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          price: l.price,
          owner_name: l.owner_name,
          owner_phone: l.owner_phone,
          description: typeof l.description === 'string' ? l.description : '',
          listing_url: url,
          source_url: url,
          source_platform: 'zillow_frbo',
          listing_type: 'rent',
          square_feet: l.square_feet,
          days_on_market: l.days_on_market ?? l.days_on_zillow,
        });
      });
      break;
    case 'fsbo':
      mapped = list.map((l) => {
        const url = l.listing_url || '';
        const address = (l.address || '').trim() || addressFromFsboUrl(url) || undefined;
        return withStoredSearchFields(l, {
          address,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          price: l.price,
          owner_name: l.owner_name,
          owner_phone: l.owner_phone,
          owner_email: l.owner_email,
          listing_url: url,
          source_url: url,
          source_platform: 'fsbo',
          listing_type: 'sale',
          square_feet: l.square_feet,
          days_on_market: l.days_on_market ?? l.days_on_zillow,
        });
      });
      break;
    case 'apartments':
      mapped = list.map((l) =>
        withStoredSearchFields(l, withApartmentsListingContactPrefill({
          address: l.address,
          title: l.title,
          description: typeof l.description === 'string' ? l.description : '',
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          price: l.price,
          owner_name: l.owner_name,
          owner_phone: l.owner_phone,
          owner_email: l.owner_email,
          listing_url: l.listing_url,
          source_url: l.listing_url,
          source_platform: 'apartments',
          listing_type: 'rent',
          square_feet: l.square_feet,
          days_on_market: l.days_on_market ?? l.days_on_zillow,
        })),
      );
      break;
    default:
      mapped = [];
  }
  return mapped;
}

/** Only show rows that belong to the scraper selected in the Platform dropdown (avoids stale Apartments rows when viewing Zillow FRBO, etc.). */
function listingMatchesRealEstatePlatform(listing: { source_platform?: string | null }, platform: string): boolean {
  if (platform === 'all') return true;
  const sp = (listing.source_platform || '').toLowerCase();
  if (!sp) return platform === 'all';
  switch (platform) {
    case 'hotpads':
      return sp === 'hotpads';
    case 'trulia':
      return sp === 'trulia';
    case 'zillow':
      return sp === 'zillow_fsbo';
    case 'zillow_frbo':
      return sp === 'zillow_frbo';
    case 'fsbo':
      return sp === 'fsbo';
    case 'apartments':
      return sp === 'apartments';
    default:
      return true;
  }
}

function plannerCatalogIconHint(hint?: string): LucideIcon {
  switch (hint) {
    case 'users':
      return Users;
    case 'building2':
      return Building2;
    case 'briefcase':
      return Briefcase;
    case 'map-pin':
      return MapPin;
    case 'home':
      return Home;
    default:
      return Target;
  }
}

const PLANNER_WELCOME_GREETING = "Hi! I'm your AI Planner. What would you like to do today?";

/** Icon tile accents — tuned for light and dark surfaces */
const PLANNER_CARD_ICON_ACCENT = [
  'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-300',
  'bg-teal-500/15 text-teal-700 ring-teal-500/25 dark:text-teal-300',
  'bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300',
  'bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:text-amber-200',
  'bg-purple-500/15 text-purple-700 ring-purple-500/25 dark:text-purple-300',
];

function formatPlannerTimestamp(ts?: number) {
  if (ts == null) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
  } catch {
    return '';
  }
}

type PlannerCardOption = {
  id: string;
  label: string;
  description?: string;
  iconHint?: string;
  group?: string;
};

function PlannerFilterCards({
  options,
  onPick,
  disabled,
}: {
  options: PlannerCardOption[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const byGroup = new Map<string, PlannerCardOption[]>();
  for (const o of options) {
    const g = o.group ?? '';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(o);
  }
  const entries = [...byGroup.entries()];
  return (
    <div className="space-y-4 w-full">
      {entries.map(([group, opts]) => (
        <div key={group || 'default'}>
          {group ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
              {group}
            </p>
          ) : null}
          <div className="overflow-x-auto pb-1 -mx-1 px-1 scroll-smooth [scrollbar-width:thin]">
            <div className="flex gap-3 min-w-min">
              {opts.map((o, idx) => {
                const Icon = plannerCatalogIconHint(o.iconHint);
                const accent = PLANNER_CARD_ICON_ACCENT[idx % PLANNER_CARD_ICON_ACCENT.length];
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(o.id)}
                    className={cn(
                      'flex shrink-0 flex-col rounded-xl border border-border/60 bg-card p-3 text-left shadow-sm transition-all',
                      'min-w-[148px] max-w-[220px] hover:border-primary/35 hover:bg-accent/35 hover:shadow-md',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      'disabled:pointer-events-none disabled:opacity-50',
                    )}
                  >
                    <div
                      className={cn(
                        'mb-2 flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset',
                        accent,
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <span className="text-sm font-semibold leading-tight text-foreground">{o.label}</span>
                    {o.description ? (
                      <span className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{o.description}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type ChatMsg = {
  role: 'user' | 'assistant';
  content: string;
  /** Epoch ms for subtle timestamps */
  createdAt?: number;
  appliedFilters?: Record<string, any>;
  planComplete?: boolean;
  suggestedTab?: string;
  /** Structured UI contract (or parse from content fenced `planner_ui`) */
  plannerUi?: PlannerUiPayload | null;
  plannerSuggestions?: string[];
  plannerFieldId?: string | null;
  fieldSummary?: Record<string, unknown>;
};

type SearchResult = {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  imported?: boolean;
};

export default function WebScraper() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLimit, setSearchLimit] = useState(10);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [importingIndex, setImportingIndex] = useState<number | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [searchCategory, setSearchCategory] = useState<'all' | 'companies' | 'people' | 'local'>('all');

  // Real Estate state
  const [reLocation, setReLocation] = useState('');
  const [rePlatform, setRePlatform] = useState<string>('all');
  const reListingType = 'sale'; // fixed; user skip traces manually after search
  const [reSaveToDb, setReSaveToDb] = useState(false);
  const [reLoading, setReLoading] = useState(false);
  const [reListings, setReListings] = useState<any[]>([]);
  /** Latest rows for async handlers (sorted/filtered UI still uses stable `realIndex` into this array). */
  const reListingsRef = useRef<any[]>([]);
  reListingsRef.current = reListings;
  const [reErrors, setReErrors] = useState<{ url: string; error: string }[]>([]);
  
  const [reBackendReachable, setReBackendReachable] = useState<boolean | null>(null);
  /** False when Zyte key is missing/invalid — live scrapes save 0 listings. */
  const [reLiveScrapeReady, setReLiveScrapeReady] = useState<boolean | null>(null);
  const [reBackendCheckInProgress, setReBackendCheckInProgress] = useState(false);
  const [skipTracingIndex, setSkipTracingIndex] = useState<number | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [selectedListings, setSelectedListings] = useState<Set<number>>(new Set());
  const [bulkSkipTracing, setBulkSkipTracing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showMap, setShowMap] = useState(true);
  /**
   * When true, table/map only shows rows whose address matches the location search box.
   * Default on: last-result returns every row ever saved for the platform (e.g. WA/MA from old runs),
   * so without this, typing "Chicago" still shows unrelated states. Turn off "Show all rows" only
   * if you need raw DB counts or addresses omit city/state text.
   */
  const [reMatchLocationFilter, setReMatchLocationFilter] = useState(true);
  /**
   * When true, backend loads/saves omit PM/broker rows (include_pm=0 / save_pm off where supported).
   * Defaults per platform: Zillow FRBO turns this on when selected (client wants private landlords only);
   * Hotpads, Trulia, Zillow FSBO, FSBO.com, Apartments start with Include PM. Toggle anytime next to Refresh.
   */
  const [reByOwnerStrict, setReByOwnerStrict] = useState(false);
  /** Last successful `/last-result` response `include_pm` (avoids badge vs toast mismatch). */
  const [reLastApiIncludePm, setReLastApiIncludePm] = useState<boolean | null>(null);
  /** Backend DB total vs PM-hidden count (so Include PM vs by-owner does not look “the same” to clients). */
  const [reLastBackendPmMeta, setReLastBackendPmMeta] = useState<ReLastBackendPmMeta | null>(null);
  /** Hotpads Find Listings: show full feed while spider runs; By-owner table filter applies after finish. */
  const [reHotpadsScrapeLive, setReHotpadsScrapeLive] = useState(false);
  /** While Find Listings is running: show rows as they land (by-owner table filter off until scrape ends). */
  const [reScrapeLiveDisplay, setReScrapeLiveDisplay] = useState(false);
  const [reRefreshingListings, setReRefreshingListings] = useState(false);
  /** Blocks overlapping Find Listings clicks while a backend scrape + poll is in flight. */
  const reScrapeInFlightRef = useRef(false);
  /** Bumps when platform changes or a new Find Listings starts; stale async scrape work must not update UI or clear loading. */
  const reScrapeGenerationRef = useRef(0);
  /** Which scrape generation turned the Find Listings spinner on — only that run may turn it off (avoids stale runs clearing a newer run’s loading). */
  const reLoadingScrapeGenRef = useRef(-1);
  /** Latest Find Listings handler (Refresh can start a live scrape when the DB has no rows for this city). */
  const runRealEstateScrapeRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    setReLastBackendPmMeta(null);
  }, [rePlatform]);

  const resolveListingAddressForMap = useCallback(
    (listing: Parameters<typeof listingDisplayAddress>[0]) => listingDisplayAddress(listing),
    [],
  );

  // Only show listings that match the searched city (applies to all scrapers: Zillow, Hotpads, Trulia, Apartments, FSBO/All Platforms)
  const reListingsFilteredForDisplay = useMemo(() => {
    let rows = reListings.map((listing, index) => ({ listing, realIndex: index }));
    rows = rows.filter(({ listing }) => listingMatchesRealEstatePlatform(listing, rePlatform));
    if (reLocation?.trim()) {
      rows = rows.filter(({ listing }) =>
        listingMatchesSearchSession(
          {
            search_city: (listing as { search_city?: string }).search_city,
            search_state: (listing as { search_state?: string }).search_state,
            address: listingDisplayAddress(listing),
            listing_url: listing.listing_url,
            source_url: listing.source_url,
          },
          reLocation,
        ),
      );
    }
    // Skip trace fills contact in React; hide PM/corporate names unless user successfully traced (always show enriched row).
    const byOwnerTable = reByOwnerStrict && !reScrapeLiveDisplay;
    if (byOwnerTable) {
      rows = rows.filter(({ listing }) => listingPassesByOwnerVisibility(listing));
    }
    if (rePlatform === 'hotpads' && byOwnerTable && rows.length > 1) {
      rows = [...rows].sort((a, b) => {
        const ra = hotpadsByOwnerDisplaySortRank(a.listing);
        const rb = hotpadsByOwnerDisplaySortRank(b.listing);
        if (ra !== rb) return ra - rb;
        return a.realIndex - b.realIndex;
      });
    } else if (rePlatform === 'hotpads' && !byOwnerTable && !reHotpadsScrapeLive && rows.length > 1) {
      // Include PM: put rows that would fail the by-owner table filter first (LLC, managed, etc.) so
      // the top of the list is not the same as by-owner (which boosts unmasked emails).
      rows = [...rows].sort((a, b) => {
        const fa = listingPassesByOwnerVisibility(a.listing) ? 1 : 0;
        const fb = listingPassesByOwnerVisibility(b.listing) ? 1 : 0;
        if (fa !== fb) return fa - fb;
        return a.realIndex - b.realIndex;
      });
    } else if (rePlatform === 'trulia' && byOwnerTable && rows.length > 1) {
      rows = [...rows].sort((a, b) => {
        const ra = isCorporateLandlordDisplayName(ownerNameForByOwnerTableFilter(a.listing), true) ? 1 : 0;
        const rb = isCorporateLandlordDisplayName(ownerNameForByOwnerTableFilter(b.listing), true) ? 1 : 0;
        if (ra !== rb) return ra - rb;
        return a.realIndex - b.realIndex;
      });
    } else if (rePlatform === 'trulia' && !byOwnerTable && rows.length > 1) {
      rows = [...rows].sort((a, b) => {
        const fa = listingPassesByOwnerVisibility(a.listing) ? 1 : 0;
        const fb = listingPassesByOwnerVisibility(b.listing) ? 1 : 0;
        if (fa !== fb) return fa - fb;
        return a.realIndex - b.realIndex;
      });
    }
    return rows;
  }, [reListings, reLocation, reMatchLocationFilter, rePlatform, reByOwnerStrict, reHotpadsScrapeLive, reScrapeLiveDisplay]);

  /** Row count after platform/by-owner filters only (no city text filter); used for "matching city" hint. */
  const reShownWithoutLocationFilter = useMemo(() => {
    let listings = reListings.filter((listing) => listingMatchesRealEstatePlatform(listing, rePlatform));
    const byOwnerTable = reByOwnerStrict && !reScrapeLiveDisplay;
    if (byOwnerTable) {
      listings = listings.filter((l) => listingPassesByOwnerVisibility(l));
    }
    return listings.length;
  }, [reListings, rePlatform, reByOwnerStrict, reScrapeLiveDisplay]);

  /** Rows in memory that match the selected platform (honest count if rows were ever mixed). */
  const reBackendRowCountForPlatform = useMemo(() => {
    let list = reListings.filter((listing) => listingMatchesRealEstatePlatform(listing, rePlatform));
    const byOwnerTable = reByOwnerStrict && !reScrapeLiveDisplay;
    if (byOwnerTable) {
      list = list.filter((l) => listingPassesByOwnerVisibility(l));
    }
    return list.length;
  }, [reListings, rePlatform, reByOwnerStrict, reScrapeLiveDisplay]);

  /** Pass search city to Railway/local last-result so deployed app returns that metro only (live scrape + filter). */
  const buildLastResultFetchOpts = useCallback(
    (includePm?: boolean): LastResultFetchOptions => ({
      includePm: includePm ?? !reByOwnerStrict,
      ...(reLocation?.trim() ? { location: reLocation.trim() } : {}),
    }),
    [reByOwnerStrict, reLocation],
  );

  /** Same row as Match & Refresh when loaded; also next to Refresh in the empty-state card so you can escape By-owner-only with 0 rows. */
  const renderListingScopeToolbar = () => {
    if (rePlatform === 'all') return null;
    return (
      <div
        className="flex flex-wrap gap-0.5 rounded-md border border-border/60 bg-muted/25 p-0.5 w-fit"
        role="group"
        aria-label="Listing scope: include PM and realtor, or by-owner only"
      >
        <Button
          type="button"
          size="sm"
          variant={!reByOwnerStrict ? 'default' : 'outline'}
          className="h-7 text-[10px] px-2 shrink-0"
          title="Load every row from the backend (brokers, LLCs, property managers). Refetches immediately."
          onClick={() => {
            setReByOwnerStrict(false);
            if (rePlatform !== 'all') {
              void fetchLastResultForPlatform(rePlatform, buildLastResultFetchOpts(true));
            }
          }}
        >
          Include PM / realtor
        </Button>
        <Button
          type="button"
          size="sm"
          variant={reByOwnerStrict ? 'default' : 'outline'}
          className="h-7 text-[10px] px-2 shrink-0"
          title="Backend hides PM/realtor/managed URLs; table hides broker-style owner names. Refetches immediately."
          onClick={() => {
            setReByOwnerStrict(true);
            if (rePlatform !== 'all') {
              void fetchLastResultForPlatform(rePlatform, buildLastResultFetchOpts(false));
            }
          }}
        >
          By-owner only
        </Button>
      </div>
    );
  };

  // Prospect Search state
  const [prospectSearchOpen, setProspectSearchOpen] = useState(false);
  const [externalFilters, setExternalFilters] = useState<Record<string, any> | null>(null);

  // Tab state (controlled)
  const [activeTab, setActiveTab] = useState('ai-chat');
  const [lensSearchTypeActive, setLensSearchTypeActive] = useState(false);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Planner (schema-driven, filter-first) state
  const [plannerMessages, setPlannerMessages] = useState<ChatMsg[]>([]);
  const [plannerInput, setPlannerInput] = useState('');
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerSelectedFilterId, setPlannerSelectedFilterId] = useState<string | null>(null);
  /** Deterministic schema-driven planner (no LLM during collection). */
  const [plannerHostState, setPlannerHostState] = useState<PlannerHostState>(createInitialPlannerHostState());
  const [plannerUseHostFlow, setPlannerUseHostFlow] = useState(false);
  const [plannerCatalogError, setPlannerCatalogError] = useState<string | null>(null);
  /** Stable “welcome” clock for the empty-state greeting only */
  const plannerWelcomeTsRef = useRef(Date.now());

  const checkReBackendReachable = useCallback(async () => {
    setReBackendCheckInProgress(true);
    setReBackendReachable(null);
    setReLiveScrapeReady(null);
    try {
      const ok = await scraperBackendApi.isScraperBackendReachable();
      setReBackendReachable(ok);
      if (ok) {
        try {
          const res = await fetch(`${scraperBackendApi.getBaseUrl()}/api/health`, { cache: 'no-store' });
          const h = (await res.json().catch(() => ({}))) as { live_scrape_ready?: boolean; zyte_key_valid?: boolean };
          setReLiveScrapeReady(h.live_scrape_ready === true || h.zyte_key_valid === true);
        } catch {
          setReLiveScrapeReady(null);
        }
      }
    } finally {
      setReBackendCheckInProgress(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'real-estate') checkReBackendReachable();
  }, [activeTab, checkReBackendReachable]);

  const filteredUnsavedIndices = useMemo(() => reListingsFilteredForDisplay.filter(({ listing }) => !listing.saved_to_db).map(({ realIndex }) => realIndex), [reListingsFilteredForDisplay]);
  const toggleSelectAllListings = () => { if (selectedListings.size === filteredUnsavedIndices.length) setSelectedListings(new Set()); else setSelectedListings(new Set(filteredUnsavedIndices)); };

  /**
   * Load the latest backend-stored scrape for a single platform (used by “Refresh listings” only).
   * Pass explicit `platform` when needed so callers aren’t blocked on the next `rePlatform` render.
   */
  const fetchLastResultForPlatform = useCallback(async (
    platform: string,
    fetchOpts?: LastResultFetchOptions,
    meta?: { silent?: boolean },
  ): Promise<{
    n: number;
    cityFilterActive: boolean;
    locationFilter?: string;
    rowsBeforeCity?: number;
    totalStored?: number;
  } | null> => {
    if (platform === 'all') {
      if (!meta?.silent) toast.info('Choose a single platform (not All), then refresh listings.');
      return null;
    }
    const silent = meta?.silent === true;
    /**
     * Invalidate any in-flight Find Listings poll (same scrapeGen). Silent probe before auto-scrape
     * must not cancel an active Find Listings run.
     */
    if (!silent) {
      reScrapeGenerationRef.current += 1;
      reScrapeInFlightRef.current = false;
      reLoadingScrapeGenRef.current = -1;
      setReLoading(false);
    }
    setReRefreshingListings(true);
    try {
      if (
        platform !== 'hotpads' &&
        platform !== 'trulia' &&
        platform !== 'zillow' &&
        platform !== 'zillow_frbo' &&
        platform !== 'fsbo' &&
        platform !== 'apartments'
      ) {
        if (!silent) {
          toast.info('Refresh works for Hotpads, Trulia, Zillow FSBO/FRBO, FSBO.com, and Apartments.com.');
        }
        return null;
      }

      let includePmFlag = fetchOpts?.includePm ?? !reByOwnerStrict;
      const fetchLast = async (includePm: boolean) => {
        const opts: LastResultFetchOptions = fetchOpts?.allCities
          ? { includePm }
          : fetchOpts?.location?.trim()
            ? { includePm, location: fetchOpts.location.trim() }
            : buildLastResultFetchOpts(includePm);
        if (platform === 'hotpads') return scraperBackendApi.getHotpadsLastResult(opts);
        if (platform === 'trulia') return scraperBackendApi.getTruliaLastResult(opts);
        if (platform === 'zillow') return scraperBackendApi.getZillowFsboLastResult(opts);
        if (platform === 'zillow_frbo') return scraperBackendApi.getZillowFrboLastResult(opts);
        if (platform === 'fsbo') return scraperBackendApi.getFsboLastResult(opts);
        return scraperBackendApi.getApartmentsLastResult(opts);
      };

      let result = await fetchLast(includePmFlag);
      if (result.error && !silent) toast.error(friendlyApiError(result.error));

      const mapKey =
        platform === 'zillow' ? 'zillow' : platform === 'zillow_frbo' ? 'zillow_frbo' : platform;
      let mapped = mapBackendListingsForPlatform(mapKey, result.listings || []);
      const r = result as {
        total_stored?: number;
        pm_rows_hidden?: number;
        location_filter?: string;
        total_before_location_filter?: number;
      };
      const dbHasRows =
        (typeof r.total_stored === 'number' && r.total_stored > 0) ||
        (typeof r.pm_rows_hidden === 'number' && r.pm_rows_hidden > 0);
      const cityFilterActive = Boolean(r.location_filter?.trim());
      const rowsBeforeCity = r.total_before_location_filter;

      /** By-owner-only returned nothing while DB still has rows → retry with PM included (explicit Refresh only). */
      if (
        !silent &&
        !includePmFlag &&
        mapped.length === 0 &&
        !result.error &&
        dbHasRows &&
        !(cityFilterActive && typeof rowsBeforeCity === 'number' && rowsBeforeCity > 0)
      ) {
        setReByOwnerStrict(false);
        includePmFlag = true;
        result = await fetchLast(true);
        if (result.error && !silent) toast.error(friendlyApiError(result.error));
        mapped = mapBackendListingsForPlatform(mapKey, result.listings || []);
        if (!silent) {
          toast.info(RE_USER_MESSAGES.by_owner_filtered_all);
        }
      }

      setReListings((prev) => withScrapedListingContactSeeds(mergeIncomingListingsWithPrevClientState(prev, mapped)));
      const n = mapped.length;
      const apiInc = (result as { include_pm?: boolean }).include_pm;
      if (typeof apiInc === 'boolean') setReLastApiIncludePm(apiInc);
      setReLastBackendPmMeta(extractBackendPmMeta(result as { include_pm?: boolean; total_stored?: number; pm_rows_hidden?: number }, n));
      const rLoaded = result as { pm_rows_hidden?: number; total_stored?: number };
      const hidden = typeof rLoaded.pm_rows_hidden === 'number' ? rLoaded.pm_rows_hidden : undefined;
      const totalDb = typeof rLoaded.total_stored === 'number' ? rLoaded.total_stored : undefined;
      const otherCitiesInDb =
        mapped.length === 0 &&
        cityFilterActive &&
        typeof rowsBeforeCity === 'number' &&
        rowsBeforeCity > 0;

      let loadSuffix: string;
      if (cityFilterActive && r.location_filter) {
        loadSuffix = ` for "${r.location_filter}"`;
      } else if (includePmFlag) {
        loadSuffix = ' (full Supabase set — nothing stripped for this request).';
      } else if (hidden !== undefined && hidden > 0 && totalDb !== undefined) {
        loadSuffix = ` (by-owner: ${hidden} PM/broker row${hidden !== 1 ? 's' : ''} hidden · ${totalDb} in DB).`;
      } else if (hidden === 0 && (totalDb ?? 0) > 0) {
        loadSuffix =
          platform === 'trulia'
            ? ' (by-owner: 0 rows matched PM rules in DB — same list as Include PM until Supabase has `trulia_strict_signal` + a fresh scrape).'
            : ' (by-owner: 0 rows matched PM rules in saved data — same count as Include PM when nothing in DB is classified as PM/broker).';
      } else {
        loadSuffix = ' (by-owner — backend applied PM/managed heuristics).';
      }
      if (!silent) {
        if (n === 0 && cityFilterActive && r.location_filter) {
          const resMeta = result as { empty_reason?: string; user_message?: string };
          const reasonMsg =
            emptyReasonUserMessage(resMeta.empty_reason, resMeta.user_message) ||
            RE_USER_MESSAGES.no_listings_found;
          toast.warning(reasonMsg, { duration: 12000 });
        } else if (n > 0) {
          const cachedMsg = (result as { user_message?: string }).user_message;
          toast.success(
            cachedMsg && cachedMsg in RE_USER_MESSAGES
              ? RE_USER_MESSAGES[cachedMsg as keyof typeof RE_USER_MESSAGES]
              : RE_USER_MESSAGES.listings_found,
          );
        }

        const r2 = result as { total_stored?: number; pm_rows_hidden?: number };
        const cityHasRowsButFiltered =
          cityFilterActive &&
          n === 0 &&
          typeof rowsBeforeCity === 'number' &&
          rowsBeforeCity > 0;
        if (cityHasRowsButFiltered) {
          toast.info(
            `${rowsBeforeCity} listing${rowsBeforeCity !== 1 ? 's' : ''} for "${r.location_filter}" are hidden by By-owner only. Click Include PM / realtor.`,
          );
        } else if (
          !includePmFlag &&
          typeof r2.pm_rows_hidden === 'number' &&
          r2.pm_rows_hidden > 0 &&
          typeof r2.total_stored === 'number' &&
          !(cityFilterActive && n === 0)
        ) {
          toast.info(
            `${r2.pm_rows_hidden} listing${r2.pm_rows_hidden !== 1 ? 's' : ''} hidden as property-manager/realtor (${r2.total_stored} in database). Click Include PM / realtor to load the full list (refetches automatically).`,
          );
        }
        if (
          (platform === 'hotpads' || platform === 'trulia') &&
          !includePmFlag &&
          typeof r2.pm_rows_hidden === 'number' &&
          r2.pm_rows_hidden === 0 &&
          typeof r2.total_stored === 'number' &&
          r2.total_stored > 0
        ) {
          toast.info(
            platform === 'trulia'
              ? 'Trulia: Run the Supabase migration adding `trulia_strict_signal`, deploy the latest backend scraper, then Find Listings again (by-owner uses owner/managed/unknown from Trulia JSON + contact heuristics).'
              : 'Hotpads: By-owner removed 0 rows beyond the PM/managed filter. If counts match Include PM, no rows were classified as PM in the database.',
          );
        }
      }
      return {
        n,
        cityFilterActive,
        locationFilter: r.location_filter,
        rowsBeforeCity,
        totalStored: totalDb,
      };
    } catch (e) {
      if (!meta?.silent) toast.error(friendlyApiError(e instanceof Error ? e.message : undefined));
      return null;
    } finally {
      setReRefreshingListings(false);
    }
  }, [reByOwnerStrict, buildLastResultFetchOpts]);

  const refreshListingsFromBackend = useCallback(
    async (opts?: { autoScrapeIfEmpty?: boolean; dbOnly?: boolean }) => {
      if (!reLocation.trim()) {
        toast.error(RE_USER_MESSAGES.enter_location);
        return;
      }
      if (rePlatform === 'all') {
        toast.info('Choose a single platform (Hotpads, Zillow, Apartments.com, etc.), then Find Listings.');
        return;
      }
      if (!isBackendRealEstatePlatform(rePlatform)) {
        await fetchLastResultForPlatform(rePlatform, buildLastResultFetchOpts());
        return;
      }
      if (opts?.dbOnly) {
        await fetchLastResultForPlatform(rePlatform, buildLastResultFetchOpts());
        return;
      }
      const stats = await fetchLastResultForPlatform(rePlatform, buildLastResultFetchOpts(), { silent: true });
      const autoScrape = opts?.autoScrapeIfEmpty !== false;
      if (
        autoScrape &&
        cityNeedsLiveScrape(stats, reLocation) &&
        !reScrapeInFlightRef.current
      ) {
        const reachable = await scraperBackendApi.isScraperBackendReachable();
        if (!reachable) {
          toast.error(RE_USER_MESSAGES.backend_unreachable);
          return;
        }
        toast.info(RE_USER_MESSAGES.needs_scrape);
        await runRealEstateScrapeRef.current?.();
        return;
      }
      if (stats && stats.n > 0) {
        toast.success(RE_USER_MESSAGES.cached_found);
      } else if (stats && stats.n === 0 && typeof stats.rowsBeforeCity === 'number' && stats.rowsBeforeCity > 0) {
        toast.warning(RE_USER_MESSAGES.by_owner_filtered_all);
      }
    },
    [fetchLastResultForPlatform, rePlatform, buildLastResultFetchOpts, reLocation],
  );

  /** Platform change only updates selection; listings load after Find Listings or Refresh listings. */
  const handleRealEstatePlatformChange = (value: string) => {
    reScrapeGenerationRef.current += 1;
    reScrapeInFlightRef.current = false;
    reLoadingScrapeGenRef.current = -1;
    setReLoading(false);
    setRePlatform(value);
    // Match scout URLs: Zillow FRBO, Hotpads, and Apartments.com all target for-rent-by-owner; default to backend PM strip unless user chooses Include PM.
    setReByOwnerStrict(
      value === 'apartments'
        ? false
        : value === 'zillow_frbo' || value === 'hotpads' || value === 'trulia',
    );
    setReLastApiIncludePm(null);
    setReHotpadsScrapeLive(false);
    setReScrapeLiveDisplay(false);
    setSelectedListings(new Set());
    setReErrors([]);
    setReListings([]);
  };

  /** True when last /last-result actually returned PM rows (or user intent before any fetch). */
  const reBackendPmIncludedFromApi =
    reLastApiIncludePm !== null ? reLastApiIncludePm : !reByOwnerStrict;

  if (authLoading || adminLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }


  // ── AI Chat Handler (uses `planner` edge function: assistant + planner modes) ──
  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Please sign in to use the AI assistant.' }]);
      return;
    }

      const { data, error: invokeError } = await supabase.functions.invoke('planner', {
        body: {
          messages: [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (invokeError) throw invokeError;

      
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: data.content || "I've configured your search filters. Switching to Brivano Lens now...",
        appliedFilters: data.filters || undefined,
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      // If filters were returned, apply them and switch to Brivano Lens
      if (data.filters) {
        setExternalFilters(data.filters);
        setActiveTab('prospect-search');
        toast.success('Filters applied — switched to Brivano Lens');
      }
    } catch {
      toast.error('Failed to get AI response');
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const applyPlannerResult = (data: {
    planComplete?: boolean;
    suggestedTab?: string | null;
    filters?: Record<string, unknown> | null;
  }) => {
    if (!data.planComplete) return;
    const f = data.filters;
    if (f && typeof f === 'object' && Object.keys(f as object).length > 0) {
      const raw = f as Record<string, unknown>;
      const city = raw.realEstateCity;
      if (typeof city === 'string' && city.trim()) {
        setReLocation(city.trim());
      }
      const { realEstateCity: _, ...payload } = raw;
      setExternalFilters(payload as Record<string, any>);
    }
    const tab = data.suggestedTab;
    if (tab) setActiveTab(tab);
    if (tab === 'prospect-search' && f && typeof f === 'object' && Object.keys(f as object).length > 0) {
      toast.success('Plan ready — filters applied in Brivano Lens');
    } else if (tab === 'prospect-search') {
      toast.success('Plan ready — Brivano Lens is open. Adjust filters if you need to.');
    } else if (tab === 'real-estate') {
      toast.success('Plan ready — set city and platform in Real Estate, then find listings');
    } else if (tab === 'search') {
      toast.success('Plan ready — run your web search in the Search tab');
    } else {
      toast.success('Plan ready');
    }
  };

  const handlePlannerSend = () => {
    if (plannerLoading) return;
    if (plannerMessages.length === 0) return;
    if (!plannerUseHostFlow) return;
    const ph = plannerHostState.phase;
    if (ph !== 'collecting_required' && ph !== 'collecting_optional') return;

    const fieldId = getCurrentFieldId(plannerHostState);
    const sel = plannerHostState.selectedType;
    if (!fieldId || !sel) return;

    const schemaField = getPlannerField(sel, fieldId);
    const rawInput = plannerInput.trim();

    if (!rawInput && ph === 'collecting_optional' && !schemaField?.required) {
      const skipped = skipOptionalField(plannerHostState, schemaField);
      setPlannerHostState(skipped);
      setPlannerInput('');
      const userMsg: ChatMsg = { role: 'user', content: '(skipped)', createdAt: Date.now() };
      if (skipped.phase === 'review') {
        const reviewUi = buildReviewPlannerUiPayload(skipped);
        const assistantMsg: ChatMsg = {
          role: 'assistant',
          content: 'Here’s what we’ll apply. Review and confirm, or edit an answer.',
          createdAt: Date.now(),
          plannerUi: reviewUi ?? undefined,
          planComplete: true,
          fieldSummary: skipped.answers,
        };
        setPlannerMessages((prev) => [...prev, userMsg, assistantMsg]);
      } else {
        const collectUi = buildCollectPlannerUiPayload(skipped);
        const assistantMsg: ChatMsg = {
          role: 'assistant',
          content: collectUi?.collect_field?.prompt ?? '',
          createdAt: Date.now(),
          plannerUi: collectUi ?? undefined,
        };
        setPlannerMessages((prev) => [...prev, userMsg, assistantMsg]);
      }
      return;
    }

    if (!rawInput && (ph === 'collecting_required' || schemaField?.required)) {
      toast.error('Please answer this question or pick a shortcut.');
      return;
    }

    if (looksLikeOffTopicAnswer(rawInput) && ph === 'collecting_required') {
      const stay = buildCollectPlannerUiPayload(plannerHostState);
      const redirect =
        'Let’s stick to your filters — answer the question above. Pick a shortcut or type in the box.';
      const userMsg: ChatMsg = { role: 'user', content: rawInput, createdAt: Date.now() };
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: redirect,
        createdAt: Date.now(),
        plannerUi: stay ?? undefined,
      };
      setPlannerMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPlannerInput('');
      return;
    }

    const value: unknown = normalizeAnswerForField(sel, fieldId, rawInput, schemaField);

    if (!validatePlannerAnswerForPhase(ph, schemaField, value)) {
      toast.error('This answer is required to apply your plan.');
      return;
    }

    const next = commitAnswer(plannerHostState, fieldId, value);
    setPlannerHostState(next);
    setPlannerInput('');
    const userMsg: ChatMsg = { role: 'user', content: rawInput, createdAt: Date.now() };

    if (next.phase === 'optional_prompt') {
      const optUi = buildOptionalPromptPlannerUiPayload(next);
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: optUi?.optional_prompt?.body ?? '',
        createdAt: Date.now(),
        plannerUi: optUi ?? undefined,
      };
      setPlannerMessages((prev) => [...prev, userMsg, assistantMsg]);
      return;
    }

    if (next.phase === 'review') {
      const reviewUi = buildReviewPlannerUiPayload(next);
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: 'Here’s what we’ll apply. Review and confirm, or edit an answer.',
        createdAt: Date.now(),
        plannerUi: reviewUi ?? undefined,
        planComplete: true,
        fieldSummary: next.answers,
      };
      setPlannerMessages((prev) => [...prev, userMsg, assistantMsg]);
      return;
    }

    const collectUi = buildCollectPlannerUiPayload(next);
    const assistantMsg: ChatMsg = {
      role: 'assistant',
      content: collectUi?.collect_field?.prompt ?? '',
      createdAt: Date.now(),
      plannerUi: collectUi ?? undefined,
    };
    setPlannerMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const handlePlannerOptionalRunNow = () => {
    if (!plannerUseHostFlow || plannerHostState.phase !== 'optional_prompt') return;
    const next = transitionOptionalPromptToReview(plannerHostState);
    setPlannerHostState(next);
    const reviewUi = buildReviewPlannerUiPayload(next);
    const assistantMsg: ChatMsg = {
      role: 'assistant',
      content: 'Here’s what we’ll apply. Review and confirm, or edit an answer.',
      createdAt: Date.now(),
      plannerUi: reviewUi ?? undefined,
      planComplete: true,
      fieldSummary: next.answers,
    };
    setPlannerMessages((prev) => [...prev, assistantMsg]);
  };

  const handlePlannerOptionalAddFilters = () => {
    if (!plannerUseHostFlow || plannerHostState.phase !== 'optional_prompt') return;
    const next = transitionOptionalPromptToCollectingOptional(plannerHostState);
    setPlannerHostState(next);
    const collectUi = buildCollectPlannerUiPayload(next);
    if (!collectUi) return;
    const assistantMsg: ChatMsg = {
      role: 'assistant',
      content: collectUi.collect_field?.prompt ?? '',
      createdAt: Date.now(),
      plannerUi: collectUi,
    };
    setPlannerMessages((prev) => [...prev, assistantMsg]);
  };

  const handlePlannerReviewBack = () => {
    if (!plannerUseHostFlow || plannerHostState.phase !== 'review') return;
    const next = transitionReviewToOptionalPrompt(plannerHostState);
    setPlannerHostState(next);
    const optUi = buildOptionalPromptPlannerUiPayload(next);
    const assistantMsg: ChatMsg = {
      role: 'assistant',
      content: optUi?.optional_prompt?.body ?? '',
      createdAt: Date.now(),
      plannerUi: optUi ?? undefined,
    };
    setPlannerMessages((prev) => [...prev, assistantMsg]);
  };

  const handlePlannerCatalogPick = (filterId: string) => {
    if (plannerLoading) return;
    setPlannerCatalogError(null);

    const flow = startPlannerFlow(filterId);
    if (flow.phase !== 'collecting_required') {
      toast.error('Unknown planner filter.');
      return;
    }

    setPlannerHostState(flow);
    setPlannerSelectedFilterId(filterId);
    setPlannerUseHostFlow(true);

    const userMsg: ChatMsg = { role: 'user', content: `Configure filter: ${filterId}`, createdAt: Date.now() };
    const ui = buildCollectPlannerUiPayload(flow);
    const assistantMsg: ChatMsg = {
      role: 'assistant',
      content: ui?.collect_field?.prompt ?? 'Let’s continue.',
      createdAt: Date.now(),
      plannerUi: ui ?? undefined,
    };
    setPlannerMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const handlePlannerSkipOptional = () => {
    if (!plannerUseHostFlow || plannerHostState.phase !== 'collecting_optional') return;
    const fieldId = getCurrentFieldId(plannerHostState);
    const sel = plannerHostState.selectedType;
    if (!fieldId || !sel) return;
    const schemaField = getPlannerField(sel, fieldId);
    if (!schemaField || schemaField.required) return;
    const next = skipOptionalField(plannerHostState, schemaField);
    setPlannerHostState(next);
    setPlannerInput('');
    const userMsg: ChatMsg = { role: 'user', content: '(skipped)', createdAt: Date.now() };
    if (next.phase === 'review') {
      const reviewUi = buildReviewPlannerUiPayload(next);
      setPlannerMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: 'assistant',
          content: 'Here’s what we’ll apply. Review and confirm, or edit an answer.',
          createdAt: Date.now(),
          plannerUi: reviewUi ?? undefined,
          planComplete: true,
          fieldSummary: next.answers,
        },
      ]);
    } else {
      const collectUi = buildCollectPlannerUiPayload(next);
      setPlannerMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: 'assistant',
          content: collectUi?.collect_field?.prompt ?? '',
          createdAt: Date.now(),
          plannerUi: collectUi ?? undefined,
        },
      ]);
    }
  };

  const handlePlannerBack = () => {
    if (
      !plannerUseHostFlow ||
      (plannerHostState.phase !== 'collecting_required' && plannerHostState.phase !== 'collecting_optional') ||
      plannerHostState.committedKeys.length === 0
    ) {
      return;
    }
    const prev = goBackOneStep(plannerHostState);
    setPlannerHostState(prev);
    setPlannerInput('');
    const ui = buildCollectPlannerUiPayload(prev);
    setPlannerMessages((p) => [
      ...p.slice(0, -2),
      {
        role: 'assistant',
        content: ui?.collect_field?.prompt ?? '',
        createdAt: Date.now(),
        plannerUi: ui ?? undefined,
      },
    ]);
  };

  const handlePlannerEditField = (fieldId: string) => {
    if (!plannerUseHostFlow) return;
    const next = goToFieldForEdit(plannerHostState, fieldId);
    setPlannerHostState(next);
    const ui = buildCollectPlannerUiPayload(next);
    setPlannerMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: ui?.collect_field?.prompt ?? 'Update your answer below.',
        createdAt: Date.now(),
        plannerUi: ui ?? undefined,
      },
    ]);
  };

  const handlePlannerApplyPlan = () => {
    if (!plannerUseHostFlow || plannerHostState.phase !== 'review' || !plannerHostState.selectedType) return;
    const sel = plannerHostState.selectedType;
    const vr = runPlannerValidation(sel, plannerHostState.answers);
    if (!vr.valid) {
      const nextKey = getNextPlannerQuestion(sel, 'collecting_required', plannerHostState.answers, vr);
      const recover: PlannerHostState = {
        ...plannerHostState,
        phase: 'collecting_required',
        currentQuestionKey: nextKey ?? plannerHostState.currentQuestionKey,
        missingFields: vr.missingFields,
      };
      setPlannerHostState(recover);
      toast.error(vr.message, { description: 'Complete the missing items below, then try again.' });
      const collectUi = buildCollectPlannerUiPayload(recover);
      if (collectUi) {
        setPlannerMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: collectUi.collect_field?.prompt ?? 'Please complete the required filters.',
            createdAt: Date.now(),
            plannerUi: collectUi,
          },
        ]);
      }
      return;
    }

    const { suggestedTab, filters } = buildApplyPayloadFromAnswers(sel, plannerHostState.answers);
    const f = filters as Record<string, unknown>;
    const pst = f.plannerSearchType as string | undefined;
    if (pst === 'jobs') {
      const merged = { ...defaultJobFilters, ...(f.jobFiltersPatch as object) };
      const r = validateScraper('jobs', merged);
      if (!r.valid) {
        toast.error(r.message, { description: 'Adjust filters in Brivano Lens, then search.' });
        return;
      }
    } else if (pst === 'people') {
      const merged = { ...defaultPeopleFilters, ...(f.peopleFiltersPatch as object) };
      const r = validateScraper('people', merged);
      if (!r.valid) {
        toast.error(r.message, { description: 'Adjust filters in Brivano Lens, then search.' });
        return;
      }
    } else if (pst === 'companies') {
      const {
        plannerSearchType: _ps,
        peopleFiltersPatch: _pf,
        jobFiltersPatch: _jf,
        localBusinessPatch: _lb,
        ...rest
      } = f;
      const merged = { ...defaultProspectFilters, ...rest };
      const r = validateScraper('companies', merged);
      if (!r.valid) {
        toast.error(r.message, { description: 'Adjust filters in Brivano Lens, then search.' });
        return;
      }
    } else if (pst === 'local' && f.localBusinessPatch) {
      const lb = f.localBusinessPatch as Record<string, unknown>;
      const r = validateScraper('local', {
        locationQuery: String(lb.locationQuery ?? ''),
        radiusMiles: typeof lb.radiusMiles === 'number' ? lb.radiusMiles : Number(lb.radiusMiles),
        searchType: String(lb.searchType ?? ''),
        keyword: String(lb.keyword ?? ''),
      });
      if (!r.valid) {
        toast.error(r.message, { description: 'Complete location, radius, and search type in Brivano Lens.' });
        return;
      }
    }

    setPlannerHostState((s) => ({ ...s, phase: 'running' }));
    applyPlannerResult({
      planComplete: true,
      suggestedTab,
      filters,
    });
    toast.success('Plan applied');
  };

  const useCaseChips = [
    { label: 'List building', icon: 'Users' },
    { label: 'Account research & scoring', icon: 'TrendingUp' },
    { label: 'Inbound lead enrichment & routing', icon: 'MailCheck' },
    { label: 'Personalized outbound', icon: 'Send' },
  ];

  const sourceCards = [
    { label: 'Find people', icon: 'UserSearch', tab: 'prospect-search' },
    { label: 'Find companies', icon: 'Building2', tab: 'prospect-search' },
    { label: 'Real estate', icon: 'Home', tab: 'real-estate' },
    { label: 'Local businesses', icon: 'MapPin', tab: 'search' },
  ];

  const chatSuggestions = [
    "Find property management companies in California",
    "SaaS companies with 50-200 employees",
    "Restaurants in New York",
    "Help me find roofing contractors in Texas",
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) { toast.error('Please enter a search query'); return; }
    setSearchLoading(true); setSearchResults([]); setSelectedResults(new Set());
    try {
      const options: { limit: number; scrapeOptions: { formats: ('markdown')[] }; category?: 'all' | 'companies' | 'local' | 'people' } = {
        limit: searchLimit,
        scrapeOptions: { formats: ['markdown'] },
      };
      if (searchCategory !== 'all') options.category = searchCategory;
      const response = await firecrawlApi.search(searchQuery, options);
      if (response.success) { setSearchResults((response.data || []).map((r: SearchResult) => ({ ...r, imported: false }))); toast.success(`Found ${response.data?.length || 0} results`); }
      else { toast.error(response.error || 'Search failed'); }
    } catch { toast.error('Search failed'); } finally { setSearchLoading(false); }
  };

  const extractBusinessName = (url: string, title: string): string => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      if (title && title.length < 60 && !title.includes('|') && !title.includes('-')) return title;
      return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } catch { return title || 'Unknown Business'; }
  };

  const importAsLead = async (result: SearchResult, index: number) => {
    if (!user?.id) { toast.error('You must be logged in to import leads'); return; }
    setImportingIndex(index);
    try {
      const businessName = extractBusinessName(result.url, result.title);
      const { error } = await supabase.from('leads').insert({ client_id: user.id, business_name: businessName, website: result.url, notes: result.description || '', source_url: result.url, status: 'new' });
      if (error) throw error;
      setSearchResults(prev => prev.map((r, i) => i === index ? { ...r, imported: true } : r));
      setSelectedResults(prev => { const next = new Set(prev); next.delete(index); return next; });
      toast.success(`Imported "${businessName}" as a new lead`);
    } catch { toast.error('Failed to import lead'); } finally { setImportingIndex(null); }
  };

  const importSelectedLeads = async () => {
    if (selectedResults.size === 0) { toast.error('Please select at least one result to import'); return; }
    setBulkImporting(true); let successCount = 0; let errorCount = 0;
    for (const index of selectedResults) {
      const result = searchResults[index]; if (result.imported) continue;
      try {
        const businessName = extractBusinessName(result.url, result.title);
        const { error } = await supabase.from('leads').insert({ client_id: user!.id, business_name: businessName, website: result.url, notes: result.description || '', source_url: result.url, status: 'new' });
        if (error) throw error; successCount++;
        setSearchResults(prev => prev.map((r, i) => i === index ? { ...r, imported: true } : r));
      } catch { errorCount++; }
    }
    setSelectedResults(new Set()); setBulkImporting(false);
    if (successCount > 0) toast.success(`Imported ${successCount} lead${successCount > 1 ? 's' : ''}`);
    if (errorCount > 0) toast.error(`Failed to import ${errorCount} lead${errorCount > 1 ? 's' : ''}`);
  };

  const toggleSelectResult = (index: number) => { setSelectedResults(prev => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; }); };
  const toggleSelectAll = () => { if (selectedResults.size === searchResults.filter(r => !r.imported).length) setSelectedResults(new Set()); else setSelectedResults(new Set(searchResults.map((r, i) => r.imported ? -1 : i).filter(i => i >= 0))); };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };
  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };


  const handleRealEstateScrape = async () => {
    if (!reLocation.trim()) {
      toast.error(RE_USER_MESSAGES.enter_location);
      return;
    }
    if (reScrapeInFlightRef.current) {
      toast.message(RE_USER_MESSAGES.scrape_in_progress);
      return;
    }

    let searchLocation = reLocation.trim();
    let searchCity: string | undefined;
    let searchState: string | undefined;
    if (isBackendRealEstatePlatform(rePlatform)) {
      const norm = await resolveSearchLocation(searchLocation);
      if (!norm.success || !norm.search_location) {
        toast.warning(RE_USER_MESSAGES.invalid_location);
        return;
      }
      searchLocation = norm.search_location;
      searchCity = norm.search_city;
      searchState = norm.search_state;
      setReLocation(searchLocation);

      const searchRes = await scraperBackendApi.realEstateSearch(rePlatform, searchLocation, {
        includePm: !reByOwnerStrict,
      });
      if (searchRes.action === 'invalid_location') {
        toast.warning(searchRes.user_message || RE_USER_MESSAGES.invalid_location);
        return;
      }
      if (searchRes.action === 'error') {
        toast.warning(searchRes.user_message || RE_USER_MESSAGES.temporary_issue);
        return;
      }
      const mapKey =
        rePlatform === 'zillow' ? 'zillow' : rePlatform === 'zillow_frbo' ? 'zillow_frbo' : rePlatform;
      if (searchRes.action === 'cached' && (searchRes.listings?.length ?? 0) > 0) {
        const mapped = mapBackendListingsForPlatform(mapKey, searchRes.listings || []).map((l) => ({
          ...l,
          search_city: l.search_city ?? searchCity,
          search_state: l.search_state ?? searchState,
          search_location: l.search_location ?? searchLocation,
        }));
        setReListings(withScrapedListingContactSeeds(mapped));
        setReMatchLocationFilter(false);
        setReScrapeLiveDisplay(false);
        setReLoading(false);
        reScrapeInFlightRef.current = false;
        toast.success(searchRes.user_message || RE_USER_MESSAGES.cached_found);
        return;
      }
      if (searchRes.action === 'cached_filtered') {
        toast.warning(searchRes.user_message || RE_USER_MESSAGES.by_owner_filtered_all);
      } else if (searchRes.action === 'scraping') {
        toast.info(RE_USER_MESSAGES.scrape_still_running);
      } else if (searchRes.action === 'needs_scrape') {
        toast.info(RE_USER_MESSAGES.needs_scrape);
      }
    }

    reScrapeInFlightRef.current = true;
    reScrapeGenerationRef.current += 1;
    const scrapeGen = reScrapeGenerationRef.current;
    reLoadingScrapeGenRef.current = scrapeGen;
    setReLoading(true);
    setReListings([]);
    setReErrors([]);
    setReScrapeLiveDisplay(true);
    const isHotpads = rePlatform === 'hotpads';
    const isTrulia = rePlatform === 'trulia';
    
    const isZillowFsbo = rePlatform === 'zillow';
    const isZillowFrbo = rePlatform === 'zillow_frbo';
    const isFsbo = rePlatform === 'fsbo';
    const isApartments = rePlatform === 'apartments';

    const st = {
      success: (msg: string, options?: Parameters<typeof toast.success>[1]) => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        if (options !== undefined) toast.success(msg, options);
        else toast.success(msg);
      },
      error: (msg: string) => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        toast.error(friendlyApiError(msg));
      },
      info: (msg: string) => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        toast.info(msg);
      },
      warning: (msg: string) => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        toast.warning(msg);
      },
      message: (msg: string, data?: Parameters<typeof toast.message>[1]) => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        if (data !== undefined) toast.message(msg, data);
        else toast.message(msg);
      },
    };

    let scrapeSafetyTimer: number | undefined;
    try {
      const applyListings = (updater: any[] | ((prev: any[]) => any[])) => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        if (typeof updater === 'function') setReListings(updater as (prev: any[]) => any[]);
        else
          setReListings((prev) =>
            withScrapedListingContactSeeds(mergeIncomingListingsWithPrevClientState(prev, updater)),
          );
      };
      const applyErrors = (next: { url: string; error: string }[]) => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        setReErrors(next);
      };
      /** True after platform change or a newer Find Listings — stop polling so old runs don’t hammer the API. */
      const scrapeCancelled = () => scrapeGen !== reScrapeGenerationRef.current;
      /** Stop spinner / in-flight lock as soon as listings are ready; Supabase insert can be slow and must not block the button. */
      const releaseScrapeUiIfOwner = () => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        if (reLoadingScrapeGenRef.current !== scrapeGen) return;
        if (scrapeSafetyTimer !== undefined) {
          window.clearTimeout(scrapeSafetyTimer);
          scrapeSafetyTimer = undefined;
        }
        reScrapeInFlightRef.current = false;
        setReLoading(false);
        reLoadingScrapeGenRef.current = -1;
      };
      const backendMapKey =
        rePlatform === 'zillow' ? 'zillow' : rePlatform === 'zillow_frbo' ? 'zillow_frbo' : rePlatform;
      let progressiveFetchCount = 0;
      let liveRowsShown = 0;
      const enrichForSearch = (listings: unknown[]) => {
        const mapped = mapBackendListingsForPlatform(backendMapKey, listings || []);
        if (!searchCity || !searchState) return mapped;
        return mapped.map((l) => ({
          ...l,
          search_city: l.search_city ?? searchCity,
          search_state: l.search_state ?? searchState,
          search_location: l.search_location ?? searchLocation,
        }));
      };
      /** Set table directly from API response (no merge, no extra client city filter). */
      const setTableFromApi = (listings: unknown[], opts?: { live?: boolean }) => {
        if (scrapeCancelled()) return;
        const rows = enrichForSearch(listings);
        setReListings(withScrapedListingContactSeeds(rows));
        setReMatchLocationFilter(false);
        setReScrapeLiveDisplay(Boolean(opts?.live));
        if (rows.length > liveRowsShown) liveRowsShown = rows.length;
        if (rows.length > 0) releaseScrapeUiIfOwner();
        if (progressiveFetchCount++ === 0 && rows.length === 0) {
          st.info(RE_USER_MESSAGES.needs_scrape);
        }
      };
      // Release lock if the backend hangs (Zillow/Hotpads/FSBO can run 30+ min; 8m was cutting off FRBO mid-poll)
      const backendScrapeLongRun =
        isHotpads || isTrulia || isZillowFsbo || isZillowFrbo || isFsbo || isApartments;
      const safetyMinutes = backendScrapeLongRun ? 45 : 8;
      scrapeSafetyTimer = window.setTimeout(() => {
        if (scrapeGen !== reScrapeGenerationRef.current) return;
        if (reLoadingScrapeGenRef.current !== scrapeGen) return;
        reScrapeInFlightRef.current = false;
        setReLoading(false);
        reLoadingScrapeGenRef.current = -1;
        st.warning(RE_USER_MESSAGES.temporary_issue);
      }, safetyMinutes * 60 * 1000);

      /** After scrape ends: full city from DB (for Refresh / next search). */
      const finalCityResultOpts = (): LastResultFetchOptions => ({
        includePm: true,
        location: searchLocation,
      });
      /** Live polls: scrape buffer on the backend (display first; DB flush when scrape ends). */
      const livePollOpts = (): LastResultFetchOptions => ({
        includePm: true,
        location: searchLocation,
      });
      const pollSearchResultsFromBackend = async (): Promise<number> => {
        if (scrapeCancelled()) return liveRowsShown;
        try {
          const result = await scraperBackendApi.fetchSearchResultsDuringScrape(
            backendMapKey,
            livePollOpts(),
            { allowDbFallback: true },
          );
          if (result.error) {
            console.debug('[scout] poll', backendMapKey, result.error);
          }
          setTableFromApi(result.listings || [], { live: true });
          return result.listings?.length ?? 0;
        } catch (e) {
          console.debug('[scout] poll failed', backendMapKey, e);
          return liveRowsShown;
        }
      };
      const finishSearchFromApi = (
        result: { listings?: unknown[]; error?: string },
        opts?: { successToast?: boolean },
      ) => {
        setTableFromApi(result.listings || []);
        if ((result.listings?.length ?? 0) === 0) {
          st.warning(RE_USER_MESSAGES.no_listings_found);
        } else if (opts?.successToast !== false) {
          st.success(RE_USER_MESSAGES.listings_found);
        }
        if (result.error) applyErrors([{ url: '', error: friendlyApiError(result.error) }]);
        releaseScrapeUiIfOwner();
      };
      const progressiveFetchIntervalMs = isApartments
        ? 2500
        : isZillowFrbo || isFsbo
          ? 5000
          : 4000;

      if (rePlatform === 'all') {
        /* Firecrawl path at end of chain */
      } else if (!isBackendRealEstatePlatform(rePlatform)) {
        st.error(RE_USER_MESSAGES.choose_platform);
        return;
      } else {
        st.info(RE_USER_MESSAGES.needs_scrape);
      }

      if (isHotpads) {
        // Check backend once so we show a clear message without multiple connection-refused console errors
        const backendReachable = await scraperBackendApi.isScraperBackendReachable();
        if (!backendReachable) {
          st.error(RE_USER_MESSAGES.temporary_issue);
          return;
        }
        // Build Hotpads URL on frontend to avoid backend search-location 500/encoding issues
        // Brivano Scout FRBO flow: must use Hotpads "for rent by owner" URL (not generic apartments-for-rent).
        const propertyType = 'for-rent-by-owner';
        let url: string | null = buildHotpadsUrl(reLocation.trim(), propertyType);
        if (!url) {
          st.error('Could not build Hotpads URL. Use a city (e.g. Chicago) or "City, State" (e.g. Chicago, Illinois or Chicago, IL).');
          return;
        }
        // Reset and always send force=1 so backend clears "already running" (works with any backend version)
        await scraperBackendApi.resetHotpadsStatus();
        const triggerRes = await scraperBackendApi.triggerFromUrl(url, {
          force: true,
          location: reLocation.trim(),
          savePm: !reByOwnerStrict,
        });
        if (triggerRes.error) {
          st.error(friendlyApiError(triggerRes.error));
          return;
        }
        st.info(RE_USER_MESSAGES.needs_scrape);
        setReHotpadsScrapeLive(true);
        await pollSearchResultsFromBackend();
        try {
        const pollInterval = 2000;
        const maxWait = 30 * 60 * 1000;
        const start = Date.now();
        let lastProgressiveFetch = Date.now() - progressiveFetchIntervalMs;
        let status = await scraperBackendApi.getHotpadsStatus();
        while (status.status === 'running' && Date.now() - start < maxWait && !scrapeCancelled()) {
          await new Promise((r) => setTimeout(r, pollInterval));
          status = await scraperBackendApi.getHotpadsStatus();
          if (scrapeCancelled()) break;
          if (status.status === 'running' && Date.now() - lastProgressiveFetch >= progressiveFetchIntervalMs) {
            lastProgressiveFetch = Date.now();
            await pollSearchResultsFromBackend();
          }
        }
        if (scrapeCancelled()) return;
        if (status.status === 'running') {
          st.warning('Scraper is still running. Showing results saved so far.');
        }
        setReHotpadsScrapeLive(false);
        await pollSearchResultsFromBackend();
        const result = await scraperBackendApi.getHotpadsLastResult(finalCityResultOpts());
        if (typeof result.include_pm === 'boolean') setReLastApiIncludePm(result.include_pm);
        setReLastBackendPmMeta(extractBackendPmMeta(result, result.listings?.length ?? 0));
        finishSearchFromApi(result);
        if (reByOwnerStrict && (result.listings?.length ?? 0) === 0) {
          st.info(RE_USER_MESSAGES.by_owner_filtered_all);
        }
        // Save to Supabase scraped_leads when "Save to Database" is on (matches frontend structure)
        if (reSaveToDb && (result.listings?.length ?? 0) > 0 && user?.id) {
          try {
            const rows = enrichForSearch(result.listings || []).map((listing) => ({
              domain: listing.source_url ? (() => { try { return new URL(listing.source_url).hostname; } catch { return 'hotpads.com'; } })() : 'hotpads.com',
              source_url: listing.source_url || listing.listing_url || null,
              address: listing.address || null,
              full_name: listing.owner_name || null,
              best_email: (listing as any).owner_email || null,
              best_phone: listing.owner_phone || null,
              all_emails: (listing as any).owner_email ? [(listing as any).owner_email] : [],
              all_phones: listing.owner_phone ? [listing.owner_phone] : [],
              status: 'new' as const,
              confidence_score: 50,
              lead_type: 'person',
              source_type: 'real_estate_scraper',
              schema_data: {
          address: listing.address,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
          price: listing.price,
                listing_type: listing.listing_type,
                source_platform: 'hotpads',
          square_feet: listing.square_feet,
              },
              enrichment_providers_used: [],
            }));
            const { data, error } = await supabase.from('scraped_leads').insert(rows).select('id');
            if (!error && data?.length) {
              applyListings((prev) => prev.map((l) => ({ ...l, saved_to_db: true })));
              st.success(`Saved ${data.length} Hotpads listings to database`);
            } else if (error) {
              const is404 = String((error as any)?.message || '').includes('404') || (error as any)?.code === 'PGRST116';
              if (is404) {
                st.info('Listings are in hotpads_listings. The "scraped_leads" table was not found—run birvanoio Supabase migrations to save to the leads pipeline.');
              } else {
                st.error('Could not save listings to database');
              }
            }
          } catch (e: any) {
            const msg = String(e?.message || '');
            const is404 = msg.includes('404') || msg.includes('Not Found');
            if (is404) {
              st.info('Listings are in hotpads_listings. The "scraped_leads" table was not found—run birvanoio Supabase migrations to save to the leads pipeline.');
      } else {
              st.error('Failed to save listings to database');
            }
          }
          }
        } finally {
          setReHotpadsScrapeLive(false);
        }
        } else if (isTrulia) {
        // Trulia: same flow as Hotpads (backend scraper, trigger-from-url, last-result)
        const backendReachable = await scraperBackendApi.isScraperBackendReachable();
        if (!backendReachable) {
          const base = scraperBackendApi.getBaseUrl();
          const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
          st.error(isLocal
            ? 'Trulia scraper backend is not running. Start the backend server (e.g. port 8080) or use "All Platforms" for FSBO/FRBO scraping.'
            : 'Deployed scraper backend is not reachable. Check your network or try again in a moment. You can also use "All Platforms".');
          return;
        }
        const url = buildTruliaUrl(reLocation.trim());
        if (!url) {
          st.error('Could not build Trulia URL. Use a city (e.g. Chicago) or "City, State" (e.g. Chicago, Illinois or Chicago, IL).');
          return;
        }
        await scraperBackendApi.resetTruliaStatus();
        const triggerRes = await scraperBackendApi.triggerFromUrl(url, {
          force: true,
          savePm: !reByOwnerStrict,
          location: reLocation.trim(),
        });
        if (triggerRes.error) {
          st.error(friendlyApiError(triggerRes.error));
          return;
        }
        st.info(
          'Trulia scrape running — table fills as rows save to Supabase (include PM while running); when it finishes, By-owner rules apply on the final load.',
        );
        await pollSearchResultsFromBackend();
        const pollInterval = 2000;
        const maxWait = 30 * 60 * 1000;
        const start = Date.now();
        let lastProgressiveFetch = Date.now() - progressiveFetchIntervalMs;
        let status = await scraperBackendApi.getTruliaStatus();
        while (status.status === 'running' && Date.now() - start < maxWait && !scrapeCancelled()) {
          await new Promise((r) => setTimeout(r, pollInterval));
          status = await scraperBackendApi.getTruliaStatus();
          if (scrapeCancelled()) break;
          if (status.status === 'running' && Date.now() - lastProgressiveFetch >= progressiveFetchIntervalMs) {
            lastProgressiveFetch = Date.now();
            await pollSearchResultsFromBackend();
          }
        }
        if (scrapeCancelled()) return;
        if (status.status === 'running') {
          st.warning('Scraper is still running. Showing results saved so far.');
        }
        await pollSearchResultsFromBackend();
        const result = await scraperBackendApi.getTruliaLastResult(finalCityResultOpts());
        finishSearchFromApi(result);
        if (reSaveToDb && (result.listings?.length ?? 0) > 0 && user?.id) {
          try {
            const rows = enrichForSearch(result.listings || []).map((listing: Record<string, any>) => ({
              domain: 'trulia.com',
              source_url: String(listing.source_url || listing.listing_url || ''),
              address: String(listing.address || ''),
              full_name: String(listing.owner_name || ''),
              best_email: null as string | null,
              best_phone: listing.owner_phone ? String(listing.owner_phone) : null,
              all_emails: [],
              all_phones: listing.owner_phone ? [listing.owner_phone] : [],
              status: 'new' as const,
              confidence_score: 50,
              lead_type: 'person',
              source_type: 'real_estate_scraper',
              schema_data: {
                address: listing.address,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                price: listing.price,
                listing_type: 'sale',
                source_platform: 'trulia',
                square_feet: listing.square_feet,
              },
              enrichment_providers_used: [],
            }));
            const { data, error } = await supabase.from('scraped_leads').insert(rows).select('id');
            if (!error && data?.length) {
              applyListings((prev) => prev.map((l) => ({ ...l, saved_to_db: true })));
              st.success(`Saved ${data.length} Trulia listings to database`);
            } else if (error) {
              st.error('Could not save listings to database');
            }
          } catch {
            st.error('Failed to save listings to database');
          }
        }
        } else if (isZillowFsbo) {
        // Zillow FSBO: search-location to get URL, trigger-from-url, then last-result from zillow_fsbo_listings
        const backendReachable = await scraperBackendApi.isScraperBackendReachable();
        if (!backendReachable) {
          const base = scraperBackendApi.getBaseUrl();
          const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
          st.error(isLocal
            ? 'Zillow FSBO scraper backend is not running. Start the backend server (e.g. port 8080) or use "All Platforms" for FSBO scraping.'
            : 'Deployed scraper backend is not reachable. Check your network or try again in a moment. You can also use "All Platforms".');
          return;
        }
        let zillowFsboUrl = buildZillowFsboUrl(reLocation.trim());
        if (!zillowFsboUrl) {
          const searchRes = await scraperBackendApi.searchLocation('zillow_fsbo', reLocation.trim());
          if (!searchRes.success || !searchRes.url) {
            st.error(searchRes.error || 'Could not build Zillow FSBO URL. Use "City, State" (e.g. Atlanta, GA).');
            return;
          }
          zillowFsboUrl = searchRes.url;
        }
        await scraperBackendApi.resetZillowFsboStatus();
        const triggerRes = await scraperBackendApi.triggerFromUrl(zillowFsboUrl, {
          force: true,
          location: reLocation.trim(),
          savePm: !reByOwnerStrict,
        });
        if (triggerRes.error) {
          st.error(friendlyApiError(triggerRes.error));
          return;
        }
        st.info('Zillow FSBO scraper started. Listings appear here as the backend saves them — open List View to watch.');
        await pollSearchResultsFromBackend();
        const pollInterval = 2000;
        const maxWait = 30 * 60 * 1000;
        const start = Date.now();
        let lastProgressiveFetch = Date.now() - progressiveFetchIntervalMs;
        let status = await scraperBackendApi.getZillowFsboStatus();
        while (status.status === 'running' && Date.now() - start < maxWait && !scrapeCancelled()) {
          await new Promise((r) => setTimeout(r, pollInterval));
          status = await scraperBackendApi.getZillowFsboStatus();
          if (scrapeCancelled()) break;
          if (status.status === 'running' && Date.now() - lastProgressiveFetch >= progressiveFetchIntervalMs) {
            lastProgressiveFetch = Date.now();
            await pollSearchResultsFromBackend();
          }
        }
        if (scrapeCancelled()) return;
        if (status.status === 'running') {
          st.warning('Scraper is still running. Showing results saved so far.');
        }
        await pollSearchResultsFromBackend();
        const result = await scraperBackendApi.getZillowFsboLastResult(finalCityResultOpts());
        finishSearchFromApi(result, { successToast: false });
        const mappedLen = result.listings?.length ?? 0;
        if (mappedLen === 0) {
          st.warning(RE_USER_MESSAGES.no_listings_found);
        }
        if (reSaveToDb && mappedLen > 0 && user?.id) {
          try {
            const rows = enrichForSearch(result.listings || []).map((listing) => ({
              domain: 'zillow.com',
              source_url: listing.source_url || listing.listing_url || null,
              address: listing.address || null,
              full_name: listing.owner_name || null,
              best_email: null,
              best_phone: listing.owner_phone || null,
              all_emails: [],
              all_phones: listing.owner_phone ? [listing.owner_phone] : [],
              status: 'new' as const,
              confidence_score: 50,
              lead_type: 'person',
              source_type: 'real_estate_scraper',
              schema_data: {
                address: listing.address,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                price: listing.price,
                listing_type: 'sale',
                source_platform: 'zillow_fsbo',
                square_feet: listing.square_feet,
              },
              enrichment_providers_used: [],
            }));
            const { data, error } = await supabase.from('scraped_leads').insert(rows).select('id');
            if (!error && data?.length) {
              applyListings((prev) => prev.map((l) => ({ ...l, saved_to_db: true })));
              st.success(`Saved ${data.length} Zillow FSBO listings to database`);
            } else if (error) {
              st.error('Could not save listings to database');
            }
          } catch {
            st.error('Failed to save listings to database');
          }
        }
        } else if (isZillowFrbo) {
        // Zillow FRBO: search-location to get URL, trigger-from-url, then last-result from zillow_frbo_listings
        const backendReachable = await scraperBackendApi.isScraperBackendReachable();
        if (!backendReachable) {
          const base = scraperBackendApi.getBaseUrl();
          const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
          st.error(isLocal
            ? 'Zillow FRBO scraper backend is not running. Start the backend server (e.g. port 8080) or use "All Platforms" for FSBO/FRBO scraping.'
            : 'Deployed scraper backend is not reachable. Check your network or try again in a moment. You can also use "All Platforms".');
          return;
        }
        const usCountryFrbo = isZillowFrboUsCountryLocation(reLocation.trim());
        let zillowFrboScrapeUrl: string | null = null;
        if (!usCountryFrbo) {
          // Prefer frontend-built plain /rentals/ URL (reliable SSR). Backend search-location as fallback.
          zillowFrboScrapeUrl = buildZillowFrboRentalsUrl(reLocation.trim());
          if (!zillowFrboScrapeUrl) {
            const searchRes = await scraperBackendApi.searchLocation('zillow_frbo', reLocation.trim());
            if (!searchRes.success || !searchRes.url) {
              st.error(searchRes.error || 'Could not find Zillow FRBO URL. Try a city (e.g. Chicago), "City, State", or "United States" for US-wide metros.');
              return;
            }
            zillowFrboScrapeUrl = searchRes.url;
          }
        }
        await scraperBackendApi.resetZillowFrboStatus();
        const triggerRes = usCountryFrbo
          ? await scraperBackendApi.triggerZillowFrboCountry({
              country: 'US',
              savePm: !reByOwnerStrict,
            })
          : await scraperBackendApi.triggerFromUrl(zillowFrboScrapeUrl!, {
              force: true,
              savePm: !reByOwnerStrict,
              location: reLocation.trim(),
            });
        if (triggerRes.error) {
          st.error(friendlyApiError(triggerRes.error));
          return;
        }
        st.info(
          usCountryFrbo
            ? 'Zillow FRBO US-wide scrape started (many major metros). This can run a long time; listings appear as the backend saves them.'
            : 'Zillow FRBO scraper started. Listings appear here as the backend saves them — open List View to watch rows fill in.',
        );
        await pollSearchResultsFromBackend();
        const pollInterval = 2000;
        const maxWait = usCountryFrbo ? 6 * 60 * 60 * 1000 : 30 * 60 * 1000;
        const start = Date.now();
        let lastProgressiveFetch = Date.now() - progressiveFetchIntervalMs;
        let status = await scraperBackendApi.getZillowFrboStatus();
        while (status.status === 'running' && Date.now() - start < maxWait && !scrapeCancelled()) {
          await new Promise((r) => setTimeout(r, pollInterval));
          status = await scraperBackendApi.getZillowFrboStatus();
          if (scrapeCancelled()) break;
          if (status.status === 'running' && Date.now() - lastProgressiveFetch >= progressiveFetchIntervalMs) {
            lastProgressiveFetch = Date.now();
            await pollSearchResultsFromBackend();
          }
        }
        if (scrapeCancelled()) return;
        if (status.status === 'running') {
          st.warning('Scraper is still running. Showing results saved so far.');
        }
        await pollSearchResultsFromBackend();
        const result = await scraperBackendApi.getZillowFrboLastResult(finalCityResultOpts());
        finishSearchFromApi(result, { successToast: false });
        if ((result.listings?.length ?? 0) > 0) {
          st.success(RE_USER_MESSAGES.listings_found);
        } else if (!result.error) {
          const meta = result as { total_stored?: number; pm_rows_hidden?: number; message?: string };
          if (meta.message) {
            st.info(meta.message);
          } else if (typeof meta.total_stored === 'number' && meta.total_stored > 0 && (meta.pm_rows_hidden ?? 0) > 0) {
            st.info(
              `${meta.pm_rows_hidden} listing(s) in Supabase are hidden as PM/realtor or managed URLs. Choose Include PM / realtor next to Refresh, then Refresh again.`,
            );
          } else if (typeof meta.total_stored === 'number' && meta.total_stored === 0) {
            st.info(
              'No rows in zillow_frbo_listings yet. The scraper needs ZYTE_API_KEY and Supabase in Omar_bucio_backend_Scraper-main/.env; check that the Python process is not exiting immediately.',
            );
          }
        }
        if (reSaveToDb && (result.listings?.length ?? 0) > 0 && user?.id) {
          try {
            const rows = enrichForSearch(result.listings || []).map((listing) => ({
              domain: 'zillow.com',
              source_url: listing.source_url || listing.listing_url || null,
              address: listing.address || null,
              full_name: listing.owner_name || null,
              best_email: null,
              best_phone: listing.owner_phone || null,
              all_emails: [],
              all_phones: listing.owner_phone ? [listing.owner_phone] : [],
              status: 'new' as const,
              confidence_score: 50,
              lead_type: 'person',
              source_type: 'real_estate_scraper',
              schema_data: {
                address: listing.address,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                price: listing.price,
                listing_type: 'rent',
                source_platform: 'zillow_frbo',
                square_feet: listing.square_feet,
              },
              enrichment_providers_used: [],
            }));
            const { data, error } = await supabase.from('scraped_leads').insert(rows).select('id');
            if (!error && data?.length) {
              applyListings((prev) => prev.map((l) => ({ ...l, saved_to_db: true })));
              st.success(`Saved ${data.length} Zillow FRBO listings to database`);
            } else if (error) {
              st.error('Could not save listings to database');
            }
          } catch {
            st.error('Failed to save listings to database');
          }
        }
        } else if (isFsbo) {
        // FSBO.com: search-location -> trigger-from-url -> poll status -> last-result from fsbo_listings
        const backendReachable = await scraperBackendApi.isScraperBackendReachable();
        if (!backendReachable) {
          const base = scraperBackendApi.getBaseUrl();
          const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
          st.error(isLocal
            ? 'FSBO.com scraper backend is not running. Start the backend server (e.g. port 8080) or use "All Platforms".'
            : 'Deployed scraper backend is not reachable. Check your network or try again.');
          return;
        }
        let fsboUrl = buildFsboSearchUrl(reLocation.trim());
        if (!fsboUrl) {
          const searchRes = await scraperBackendApi.searchLocation('fsbo', reLocation.trim());
          if (!searchRes.success || !searchRes.url) {
            st.error(searchRes.error || 'Could not build FSBO.com URL. Use "City, State" (e.g. Atlanta, GA).');
            return;
          }
          fsboUrl = searchRes.url;
        }
        await scraperBackendApi.resetFsboStatus();
        const triggerRes = await scraperBackendApi.triggerFromUrl(fsboUrl, {
          force: true,
          location: reLocation.trim(),
          savePm: !reByOwnerStrict,
        });
        if (triggerRes.error) {
          st.error(friendlyApiError(triggerRes.error));
          return;
        }
        st.info('FSBO.com scraper started. Listings will appear as they are scraped.');
        await pollSearchResultsFromBackend();
        const pollInterval = 2000;
        const maxWait = 25 * 60 * 1000; // 25 min (FSBO can take 15–20 min for 128 listings)
        const start = Date.now();
        let lastProgressiveFetch = Date.now() - progressiveFetchIntervalMs;
        let status = await scraperBackendApi.getFsboStatus();
        while (status.status === 'running' && Date.now() - start < maxWait && !scrapeCancelled()) {
          await new Promise((r) => setTimeout(r, pollInterval));
          status = await scraperBackendApi.getFsboStatus();
          if (scrapeCancelled()) break;
          if (status.status === 'running' && Date.now() - lastProgressiveFetch >= progressiveFetchIntervalMs) {
            lastProgressiveFetch = Date.now();
            await pollSearchResultsFromBackend();
          }
        }
        if (scrapeCancelled()) return;
        if (status.status === 'running') {
          st.warning('Scraper is still running. Showing results saved so far.');
        }
        await pollSearchResultsFromBackend();
        const result = await scraperBackendApi.getFsboLastResult(finalCityResultOpts());
        finishSearchFromApi(result);
        if (reSaveToDb && (result.listings?.length ?? 0) > 0 && user?.id) {
          try {
            const rows = enrichForSearch(result.listings || []).map((listing) => ({
              domain: 'forsalebyowner.com',
              source_url: listing.source_url || listing.listing_url || null,
              address: listing.address || null,
              full_name: listing.owner_name || null,
              best_email: (listing as any).owner_email || null,
              best_phone: listing.owner_phone || null,
              all_emails: (listing as any).owner_email ? [(listing as any).owner_email] : [],
              all_phones: listing.owner_phone ? [listing.owner_phone] : [],
              status: 'new' as const,
              confidence_score: 50,
              lead_type: 'person',
              source_type: 'real_estate_scraper',
              schema_data: {
                address: listing.address,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                price: listing.price,
                listing_type: 'sale',
                source_platform: 'fsbo',
                square_feet: listing.square_feet,
              },
              enrichment_providers_used: [],
            }));
            const { data, error } = await supabase.from('scraped_leads').insert(rows).select('id');
            if (!error && data?.length) {
              applyListings((prev) => prev.map((l) => ({ ...l, saved_to_db: true })));
              st.success(`Saved ${data.length} FSBO.com listings to database`);
            } else if (error) {
              st.error('Could not save listings to database');
            }
          } catch {
            st.error('Failed to save listings to database');
          }
        }
        } else if (isApartments) {
        if (reByOwnerStrict) {
          st.info(
            'Apartments.com is mostly property managers. Listings still appear while scraping; use Include PM / realtor to keep every contact after the run.',
          );
        }
        const backendReachable = await scraperBackendApi.isScraperBackendReachable();
        if (!backendReachable) {
          const base = scraperBackendApi.getBaseUrl();
          const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
          st.error(isLocal ? 'Apartments.com scraper backend is not running. Start the backend server (e.g. port 8080).' : 'Deployed scraper backend is not reachable.');
          return;
        }
        let apartmentsUrl = buildApartmentsFrboUrl(reLocation.trim());
        if (!apartmentsUrl) {
          const searchRes = await scraperBackendApi.searchLocation('apartments', reLocation.trim(), 'apartments');
          if (searchRes.success && searchRes.url) {
            apartmentsUrl = searchRes.url.replace(/\/?$/, '/for-rent-by-owner/');
            if (!apartmentsUrl.includes('for-rent-by-owner')) {
              apartmentsUrl = `${searchRes.url.replace(/\/$/, '')}/for-rent-by-owner/`;
            }
          } else {
            st.error(searchRes.error || 'Could not build Apartments.com URL. Use "City, State" (e.g. Atlanta, GA).');
            return;
          }
        }
        await scraperBackendApi.resetApartmentsStatus();
        const triggerRes = await scraperBackendApi.triggerFromUrl(apartmentsUrl, {
          force: true,
          location: reLocation.trim(),
          savePm: !reByOwnerStrict,
        });
        if (triggerRes.error) {
          st.error(friendlyApiError(triggerRes.error));
          return;
        }
        st.info(`Searching ${searchLocation} — listings will appear here as they are found, then saved when the search finishes.`);
        await pollSearchResultsFromBackend();
        const pollInterval = 2000;
        const maxWait = 30 * 60 * 1000;
        const start = Date.now();
        let lastProgressiveFetch = Date.now() - progressiveFetchIntervalMs;
        let status = await scraperBackendApi.getApartmentsStatus();
        while (status.status === 'running' && Date.now() - start < maxWait && !scrapeCancelled()) {
          await new Promise((r) => setTimeout(r, pollInterval));
          status = await scraperBackendApi.getApartmentsStatus();
          if (scrapeCancelled()) break;
          if (status.status === 'running' && Date.now() - lastProgressiveFetch >= progressiveFetchIntervalMs) {
            lastProgressiveFetch = Date.now();
            await pollSearchResultsFromBackend();
          }
        }
        if (scrapeCancelled()) return;
        if (status.status === 'running') st.warning('Scraper is still running. Showing results saved so far.');
        await pollSearchResultsFromBackend();
        const result = await scraperBackendApi.getApartmentsLastResult(finalCityResultOpts());
        finishSearchFromApi(result);
        if (reSaveToDb && (result.listings?.length ?? 0) > 0 && user?.id) {
          try {
            const rows = enrichForSearch(result.listings || []).map((listing) => ({
              domain: 'apartments.com',
              source_url: listing.source_url || listing.listing_url || null,
              address: listing.address || null,
              full_name: listing.owner_name || null,
              best_email: (listing as any).owner_email || null,
              best_phone: listing.owner_phone || null,
              all_emails: (listing as any).owner_email ? [(listing as any).owner_email] : [],
              all_phones: listing.owner_phone ? [listing.owner_phone] : [],
              status: 'new' as const, confidence_score: 50, lead_type: 'person', source_type: 'real_estate_scraper',
              schema_data: { address: listing.address, bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, price: listing.price, listing_type: 'rent', source_platform: 'apartments', square_feet: listing.square_feet },
              enrichment_providers_used: [],
            }));
            const { data, error } = await supabase.from('scraped_leads').insert(rows).select('id');
            if (!error && data?.length) {
              applyListings((prev) => prev.map((l) => ({ ...l, saved_to_db: true })));
              st.success(`Saved ${data.length} Apartments.com listings to database`);
            } else if (error) st.error('Could not save listings to database');
          } catch { st.error('Failed to save listings to database'); }
        }
        } else {
        // All Platforms: FSBO/FRBO uses Edge Function that requires signed-in admin
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          st.error('Please sign in to use Find Listings.');
          return;
        }
        try {
          const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user?.id, _role: 'admin' });
          if (isAdmin === false) {
            st.error('Admin access is required to run the FSBO/FRBO scraper.');
            return;
          }
        } catch {
          // has_role RPC may be missing if migrations not run; let Edge Function enforce auth
        }
        const response = await firecrawlApi.scrapeAndTraceFSBO({ location: reLocation, platform: rePlatform as any, listingType: reListingType, enableSkipTrace: false, saveToDatabase: reSaveToDb });
        if (response.success) {
          applyListings(response.listings || []);
          if (response.errors?.length) applyErrors(response.errors);
          st.success(`Found ${response.total || 0} listings`);
          if (reSaveToDb && response.saved_to_database) st.success(`Saved ${response.saved_to_database} leads to database`);
          releaseScrapeUiIfOwner();
        } else {
          st.error(response.error || 'Failed to scrape listings');
        }
      }
    } catch (e: unknown) {
      console.debug('[scout] search failed', e);
      st.error(friendlyApiError(e instanceof Error ? e.message : String(e)));
    } finally {
      if (scrapeSafetyTimer !== undefined) window.clearTimeout(scrapeSafetyTimer);
      if (scrapeGen > 0 && scrapeGen === reScrapeGenerationRef.current) {
        reScrapeInFlightRef.current = false;
        setReScrapeLiveDisplay(false);
        setReHotpadsScrapeLive(false);
      }
      if (scrapeGen > 0 && reLoadingScrapeGenRef.current === scrapeGen) {
        setReLoading(false);
        reLoadingScrapeGenRef.current = -1;
      }
    }
  };
  runRealEstateScrapeRef.current = handleRealEstateScrape;

  const exportListingsToCSV = () => {
    if (reListings.length === 0) return;
    const headers = ['Address', 'Bedrooms', 'Bathrooms', 'Price', 'Days on Market', 'Favorites', 'Views', 'Listing Type', 'Property Type', 'Sq Ft', 'Year Built', 'Owner Name', 'Owner Phone', 'Owner Email', 'Source URL'];
    const rows = reListings.map(l => [l.address || '', l.bedrooms || '', l.bathrooms || '', l.price || '', l.days_on_market || '', l.favorites_count || '', l.views_count || '', l.listing_type || '', l.property_type || '', l.square_feet || '', l.year_built || '', l.owner_name || '', l.owner_phone || '', l.owner_email || '', l.source_url || '']);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadAsFile(csv, `fsbo-listings-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Exported listings to CSV');
  };

  const handleSkipTraceListing = async (listing: any, index: number) => {
    const row = reListingsRef.current[index] ?? listing;
    const addrLine = addressForSkipTrace(row);
    if (!addrLine) { toast.error('No address available for skip trace'); return; }
    setSkipTracingIndex(index);
    setReListings((prev) =>
      prev.map((l, i) =>
        i !== index ? l : { ...l, skip_trace_status: l.skip_trace_status === 'not_found' ? undefined : l.skip_trace_status },
      ),
    );
    try {
      const parsed = skipTraceApi.parseAddress(addrLine);
      const sp = (row.source_platform || '').toLowerCase();
      const result = await skipTraceApi.lookupOwner({ ...parsed, source_platform: sp || undefined });
      const latest = reListingsRef.current[index] ?? row;
      const merged = mergeSkipTraceResultWithApartmentsFallback(latest, result);
      if (merged) {
        const { data, fromApartmentsListing } = merged;
        const providers = fromApartmentsListing ? ['apartments_listing_contact'] : ['batchdata'];
        const traceName = (data.fullName && String(data.fullName).trim()) || '';
        const listContact = (latest.scraped_listing_contact_name || latest.owner_name || '').trim();
        const strictFrbo = sp === 'zillow_frbo';
        const badAssessor =
          !!traceName &&
          (isQuasiPublicEntityDisplayName(traceName) ||
            (strictFrbo && isCorporateLandlordDisplayName(traceName, true)));
        const updated = buildListingAfterSkipTrace(latest, data, sp, providers);
        let saved = false;
        if (user?.id) {
          try {
            const { error } = await supabase.from('scraped_leads').insert({
              domain: updated.source_url ? new URL(updated.source_url).hostname : 'unknown',
              source_url: updated.source_url || updated.listing_url,
              address: updated.address || null,
              full_name: updated.owner_name,
              best_email: updated.owner_email,
              best_phone: updated.owner_phone,
              all_emails: updated.all_emails?.map((e: any) => e.address ?? e) ?? (updated.owner_email ? [updated.owner_email] : []),
              all_phones: updated.all_phones?.map((p: any) => p.number ?? p) ?? (updated.owner_phone ? [updated.owner_phone] : []),
              status: 'new',
              confidence_score: updated.skip_trace_confidence || 50,
              lead_type: 'person',
              source_type: 'real_estate_scraper',
              schema_data: {
                address: updated.address,
                bedrooms: updated.bedrooms,
                bathrooms: updated.bathrooms,
                price: updated.price,
                days_on_market: updated.days_on_market,
                property_type: updated.property_type,
                square_feet: updated.square_feet,
                year_built: updated.year_built,
                listing_type: updated.listing_type,
                source_platform: updated.source_platform,
                skip_trace_assessor_name: updated.skip_trace_assessor_name ?? null,
              },
              enrichment_providers_used: providers,
            });
            saved = !error;
          } catch {
            saved = false;
          }
        }
        setReListings((prev) =>
          prev.map((l, i) => (i !== index ? l : { ...updated, saved_to_db: saved || l.saved_to_db })),
        );
        const label =
          updated.owner_name?.trim() ||
          (updated.owner_phone ? formatUsPhoneForDisplay(String(updated.owner_phone)) : '') ||
          updated.owner_email ||
          'Contact found';
        if (fromApartmentsListing) {
          toast.success(
            saved
              ? `Apartments.com contact saved (${label}). BatchData had no parcel owner — using the manager/phone from the listing.`
              : `Apartments.com contact: ${label}. BatchData had no parcel owner — sign in to auto-save leads.`,
          );
        } else if (badAssessor && listContact && traceName) {
          toast.success(
            saved
              ? `Skip trace: kept listing contact "${listContact}" (assessor record was "${traceName}" — not a private landlord). Lead saved.`
              : `Skip trace: kept "${listContact}" on card. Assessor: "${traceName}".${user?.id ? '' : ' Sign in to auto-save.'}`,
          );
        } else {
          toast.success(
            saved
              ? `Skip trace: ${label}. Lead saved to database.`
              : `Skip trace: ${label}${user?.id ? ' (not saved — check Supabase).' : ' (sign in to auto-save leads).'}`,
          );
        }
      } else {
        const hint =
          result.message ||
          result.error ||
          'No owner record returned (common for large apartment buildings — try the listing contact instead).';
        const batchDataEmpty =
          result.success === true &&
          !(result.error || '').trim() &&
          (!result.data?.phones?.length && !result.data?.emails?.length && !result.data?.fullName?.trim());
        if (sp === 'apartments' && !(latest.owner_phone || latest.owner_name)) {
          toast.info(APARTMENTS_SKIP_TRACE_NO_MATCH_HINT);
        } else if (batchDataEmpty) {
          toast.info(
            `${hint}. Skip trace uses property-owner records (assessor-style), not the listing agent. Rentals and PM-managed units often return nothing — use the phone/name on the Zillow card if you need a contact now.`,
          );
        } else {
          toast.error(hint);
        }
        setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, skip_trace_status: 'not_found' }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to skip trace');
    } finally { setSkipTracingIndex(null); }
  };

  const handleSaveListing = async (listing: any, index: number) => {
    if (!user?.id) { toast.error('You must be logged in'); return; }
    setSavingIndex(index);
    try {
      const { error } = await supabase.from('scraped_leads').insert({
        domain: listing.source_url ? new URL(listing.source_url).hostname : 'unknown',
        source_url: listing.source_url || listing.listing_url,
        address: listing.address || null,
        full_name: listing.owner_name, best_email: listing.owner_email, best_phone: listing.owner_phone,
        all_emails: listing.all_emails?.map((e: any) => e.address || e) || (listing.owner_email ? [listing.owner_email] : []),
        all_phones: listing.all_phones?.map((p: any) => p.number || p) || (listing.owner_phone ? [listing.owner_phone] : []),
        status: 'new', confidence_score: listing.skip_trace_confidence || 50, lead_type: 'person', source_type: 'real_estate_scraper',
        schema_data: { address: listing.address, bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, price: listing.price, days_on_market: listing.days_on_market, property_type: listing.property_type, square_feet: listing.square_feet, year_built: listing.year_built, listing_type: listing.listing_type, source_platform: listing.source_platform },
        enrichment_providers_used:
          listing.skip_trace_status === 'success'
            ? (Array.isArray(listing.enrichment_providers_used) && listing.enrichment_providers_used.length
                ? listing.enrichment_providers_used
                : ['batchdata'])
            : [],
      });
      if (error) throw error;
      setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, saved_to_db: true }));
      toast.success('Lead saved to database');
    } catch { toast.error('Failed to save lead'); } finally { setSavingIndex(null); }
  };

  const toggleListingSelection = (index: number) => { setSelectedListings(prev => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; }); };

  const handleBulkSkipTrace = async () => {
    const toProcess = Array.from(selectedListings).filter((i) => {
      const l = reListings[i];
      // User explicitly selected rows — allow re-skip even if the listing already has a scraped agent/office phone.
      return (
        l &&
        !!addressForSkipTrace(l) &&
        l.skip_trace_status !== 'success'
      );
    });
    if (toProcess.length === 0) {
      toast.error('No listings to skip trace (selected rows need a usable address or FSBO listing URL, and must not already be traced).');
      return;
    }
    setBulkSkipTracing(true); let successCount = 0; let errorCount = 0; let savedCount = 0;
    for (const index of toProcess) {
      const listing = reListings[index];
      const addrLine = addressForSkipTrace(listing);
      if (!addrLine) continue;
      try {
        const parsed = skipTraceApi.parseAddress(addrLine);
        const sp = (listing.source_platform || '').toLowerCase();
        const result = await skipTraceApi.lookupOwner({ ...parsed, source_platform: sp || undefined });
        const merged = mergeSkipTraceResultWithApartmentsFallback(listing, result);
        if (merged) {
          const { data, fromApartmentsListing } = merged;
          const providers = fromApartmentsListing ? ['apartments_listing_contact'] : ['batchdata'];
          const updated = buildListingAfterSkipTrace(listing, data, sp, providers);
          setReListings(prev => prev.map((l, i) => i !== index ? l : updated));
          successCount++;
          if (user?.id) {
            try {
              const { error } = await supabase.from('scraped_leads').insert({
                domain: updated.source_url ? new URL(updated.source_url).hostname : 'unknown',
                source_url: updated.source_url || updated.listing_url,
                address: updated.address || null,
                full_name: updated.owner_name, best_email: updated.owner_email, best_phone: updated.owner_phone,
                all_emails: updated.all_emails?.map((e: any) => e.address ?? e) ?? (updated.owner_email ? [updated.owner_email] : []),
                all_phones: updated.all_phones?.map((p: any) => p.number ?? p) ?? (updated.owner_phone ? [updated.owner_phone] : []),
                status: 'new', confidence_score: updated.skip_trace_confidence || 50, lead_type: 'person', source_type: 'real_estate_scraper',
                schema_data: {
                  address: updated.address,
                  bedrooms: updated.bedrooms,
                  bathrooms: updated.bathrooms,
                  price: updated.price,
                  days_on_market: updated.days_on_market,
                  property_type: updated.property_type,
                  square_feet: updated.square_feet,
                  year_built: updated.year_built,
                  listing_type: updated.listing_type,
                  source_platform: updated.source_platform,
                  skip_trace_assessor_name: updated.skip_trace_assessor_name ?? null,
                },
                enrichment_providers_used: providers,
              });
              if (!error) {
                setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, saved_to_db: true }));
                savedCount++;
              }
            } catch { /* ignore */ }
          }
        } else { setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, skip_trace_status: 'not_found' })); errorCount++; }
      } catch { errorCount++; }
    }
    setBulkSkipTracing(false);
    toast.success(`Skip traced ${successCount} listings (${savedCount} saved to database${errorCount ? `, ${errorCount} not found` : ''})`);
  };

  const handleBulkSave = async () => {
    const toSave = Array.from(selectedListings).filter(i => reListings[i] && !reListings[i].saved_to_db);
    if (toSave.length === 0) { toast.error('No new listings to save'); return; }
    setBulkSaving(true); let successCount = 0; let errorCount = 0;
    for (const index of toSave) {
      const listing = reListings[index];
      try {
        const { error } = await supabase.from('scraped_leads').insert({
          domain: listing.source_url ? new URL(listing.source_url).hostname : 'unknown',
          source_url: listing.source_url || listing.listing_url,
          address: listing.address || null,
          full_name: listing.owner_name, best_email: listing.owner_email, best_phone: listing.owner_phone,
          all_emails: listing.all_emails?.map((e: any) => e.address || e) || (listing.owner_email ? [listing.owner_email] : []),
          all_phones: listing.all_phones?.map((p: any) => p.number || p) || (listing.owner_phone ? [listing.owner_phone] : []),
          status: 'new', confidence_score: listing.skip_trace_confidence || 50, lead_type: 'person', source_type: 'real_estate_scraper',
          schema_data: { address: listing.address, bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, price: listing.price, days_on_market: listing.days_on_market, property_type: listing.property_type, square_feet: listing.square_feet, year_built: listing.year_built, listing_type: listing.listing_type, source_platform: listing.source_platform },
          enrichment_providers_used:
            listing.skip_trace_status === 'success'
              ? (Array.isArray(listing.enrichment_providers_used) && listing.enrichment_providers_used.length
                  ? listing.enrichment_providers_used
                  : ['batchdata'])
              : [],
        });
        if (error) throw error;
        setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, saved_to_db: true })); successCount++;
      } catch { errorCount++; }
    }
    setSelectedListings(new Set()); setBulkSaving(false); toast.success(`Saved ${successCount} leads (${errorCount} failed)`);
  };

  return (
    <DashboardLayout fullWidth>
      <div className={lensSearchTypeActive && activeTab === 'prospect-search' ? '' : 'space-y-5'}>
        {!(lensSearchTypeActive && activeTab === 'prospect-search') && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Brivano Scout</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Find prospects, scrape listings, and enrich your pipeline</p>
          </div>
        </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className={lensSearchTypeActive && activeTab === 'prospect-search' ? '' : 'space-y-4'}>
          {!(lensSearchTypeActive && activeTab === 'prospect-search') && (
            <TabsList className="h-10 p-1 bg-muted/40 border border-border/30 gap-0.5">
              <TabsTrigger value="ai-chat" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> AI Assistant
              </TabsTrigger>
              <TabsTrigger value="planner" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <ClipboardList className="h-3.5 w-3.5" /> Planner
              </TabsTrigger>
              <TabsTrigger value="prospect-search" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Target className="h-3.5 w-3.5" /> Brivano Lens
              </TabsTrigger>
              <TabsTrigger value="real-estate" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Home className="h-3.5 w-3.5" /> Real Estate
              </TabsTrigger>
              <TabsTrigger value="job-scraper" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Briefcase className="h-3.5 w-3.5" /> Job Scraper
              </TabsTrigger>
              <TabsTrigger value="search" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Search className="h-3.5 w-3.5" /> Search
              </TabsTrigger>
            </TabsList>
          )}

          {/* ── Prospect Search Tab ── */}
          <TabsContent value="prospect-search" className="mt-0">
            <BrivanoLens externalFilters={externalFilters} onSwitchTab={setActiveTab} onSearchTypeChange={setLensSearchTypeActive} />
          </TabsContent>

          {/* ── Tech Stack Search Tab ── */}
          <TabsContent value="tech-search" className="mt-0">
            <TechnographicsSearch />
          </TabsContent>

          {/* ── Lookalike Search Tab ── */}
          <TabsContent value="lookalike" className="mt-0">
            <LookalikeSearch />
          </TabsContent>

          {/* ── Domain Resolver Tab ── */}
          <TabsContent value="domain-resolve" className="mt-0">
            <DomainResolver />
          </TabsContent>

          {/* ── Bulk Email Finder Tab ── */}
          <TabsContent value="email-finder" className="mt-0">
            <BulkEmailFinder />
          </TabsContent>

          {/* ── Dynamic Lists Tab ── */}
          <TabsContent value="lists" className="mt-0">
            <DynamicLists />
          </TabsContent>

          <TabsContent value="ai-chat" className="mt-0">
            <Card className="border-border/40 bg-card/50">
              <CardContent className="p-0">
                <div className="flex flex-col h-[600px]">
                  <ScrollArea className="flex-1 p-5">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-12 px-4">
                        {/* Hero */}
                        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold tracking-tight mb-1">What can we help you build?</h3>
                        <p className="text-sm text-muted-foreground mb-8">Describe your ideal prospects or pick a workflow below</p>

                        {/* Use-case chips */}
                        <div className="flex flex-wrap gap-2 justify-center mb-8">
                          {useCaseChips.map((chip) => {
                            const IconComp = chip.icon === 'Users' ? Users : chip.icon === 'TrendingUp' ? TrendingUp : chip.icon === 'MailCheck' ? MailCheck : Send;
                            return (
                              <button
                                key={chip.label}
                                onClick={() => setChatInput(chip.label)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-xs font-medium text-muted-foreground hover:text-foreground"
                              >
                                <IconComp className="h-3.5 w-3.5" />
                                {chip.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Source grid */}
                        <div className="w-full max-w-xl">
                          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Start from a source</p>
                          <div className="grid grid-cols-4 gap-3">
                            {sourceCards.map((card) => {
                              const iconMap: Record<string, any> = { UserSearch, Building2, MapPin, Home, FileUp, Sparkles, Cpu, Target, Globe, MailIcon, ListFilter };
                              const IconComp = iconMap[card.icon] || Sparkles;
                              return (
                                <button
                                  key={card.label}
                                  onClick={() => {
                                    if (card.tab === 'ai-chat') {
                                      setChatInput(card.label);
                                    } else {
                                      setActiveTab(card.tab);
                                    }
                                  }}
                                  className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                                >
                                  <div className="h-9 w-9 rounded-lg bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                    <IconComp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                  </div>
                                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">{card.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[80%] space-y-1.5">
                              <div className={`rounded-xl px-4 py-2.5 text-sm ${
                                msg.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted/60'
                              }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                              {msg.appliedFilters && (
                                <div className="flex items-center gap-1.5 flex-wrap px-1">
                                  <Target className="h-3 w-3 text-primary flex-shrink-0" />
                                  <span className="text-[10px] text-primary font-medium">Filters applied →</span>
                                  {Object.entries(msg.appliedFilters)
                                    .filter(([_, v]) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== ''))
                                    .map(([k]) => (
                                      <Badge key={k} variant="secondary" className="text-[9px] px-1.5 py-0">
                                        {k.replace(/([A-Z])/g, ' $1').trim()}
                                      </Badge>
                                    ))}
                                  <span className="text-[10px] text-muted-foreground">• Switching to Brivano Lens...</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-muted/60 rounded-xl px-4 py-2.5">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="border-t border-border/60 p-4">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Describe what companies you're looking for... e.g. 'property management in California'"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                        className="min-h-[40px] max-h-[100px] resize-none text-sm"
                        rows={1}
                      />
                      <Button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()} size="sm" className="h-10 px-3 shrink-0">
                        {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      I'll automatically configure filters and search in Brivano Lens for you.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="planner" className="mt-0">
            <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <CardContent className="p-0">
                <div className="flex flex-col h-[min(640px,72vh)]">
                  <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-border/50 bg-muted/20">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold tracking-tight flex items-center gap-2 text-foreground">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/15">
                          <ClipboardList className="h-4 w-4" />
                        </span>
                        Planner
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1.5 max-w-lg leading-relaxed">
                        Ask anything or pick a category to get started.
                      </p>
                    </div>
                    {plannerMessages.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 shrink-0 text-xs"
                        disabled={plannerLoading}
                        onClick={() => {
                          setPlannerMessages([]);
                          setPlannerInput('');
                          setPlannerHostState(createInitialPlannerHostState());
                          setPlannerSelectedFilterId(null);
                          setPlannerUseHostFlow(false);
                          setPlannerCatalogError(null);
                        }}
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Start over
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="flex-1 px-5 py-4">
                    {plannerMessages.length === 0 ? (
                      <div className="space-y-4 max-w-3xl mx-auto pb-2">
                        {plannerCatalogError ? (
                          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {plannerCatalogError}
                          </div>
                        ) : null}
                        <div className="flex gap-3 items-start">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-border/60"
                            aria-hidden
                          >
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="rounded-2xl rounded-tl-md border border-border/50 bg-muted/30 px-4 py-3 text-sm shadow-sm">
                              <p className="text-foreground leading-relaxed">{PLANNER_WELCOME_GREETING}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground px-0.5">
                              {formatPlannerTimestamp(plannerWelcomeTsRef.current)}
                            </p>
                            <PlannerFilterCards
                              options={[...PLANNER_FILTER_CATALOG]
                                .sort((a, b) => a.order - b.order)
                                .map((e) => ({
                                  id: e.id,
                                  label: e.label,
                                  description: e.description,
                                  iconHint: e.iconHint,
                                  group: e.group,
                                }))}
                              onPick={(id) => void handlePlannerCatalogPick(id)}
                              disabled={plannerLoading}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5 max-w-3xl mx-auto pb-2">
                        {plannerCatalogError && (
                          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {plannerCatalogError}
                          </div>
                        )}
                        {plannerMessages.map((msg, i) => {
                          const ui = msg.role === 'assistant' ? msg.plannerUi ?? parsePlannerUiBlock(msg.content) : null;
                          const prose =
                            msg.role === 'assistant'
                              ? ui?.phase === 'pick_filter' && ui.pick_filter?.prompt
                                ? ui.pick_filter.prompt
                                : ui?.phase === 'optional_prompt' && ui.optional_prompt?.body
                                  ? ui.optional_prompt.body
                                  : ui?.phase === 'collect_field' && ui.collect_field?.prompt
                                    ? ui.collect_field.prompt
                                    : stripPlannerUiFence(msg.content)
                              : msg.content;
                          const phaseLabel =
                            msg.role === 'assistant'
                              ? ui?.phase === 'pick_filter'
                                ? 'Filter catalog'
                                : ui?.phase === 'optional_prompt'
                                  ? 'Optional filters'
                                  : ui?.phase === 'collect_field'
                                    ? 'Question'
                                    : ui?.phase === 'review' || msg.planComplete
                                      ? 'Review'
                                      : !msg.planComplete
                                        ? 'Question'
                                        : null
                              : null;

                          return (
                            <div key={i} className="w-full">
                              {msg.role === 'user' ? (
                                <div className="flex flex-col items-end gap-1 max-w-[92%] ml-auto">
                                  <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                  </div>
                                  {msg.createdAt ? (
                                    <span className="text-[10px] text-muted-foreground pr-1">
                                      {formatPlannerTimestamp(msg.createdAt)}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5 w-full">
                                  {phaseLabel ? (
                                    <div className="flex flex-wrap items-center gap-2 px-1">
                                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                        {phaseLabel}
                                      </span>
                                      {ui?.phase === 'collect_field' && ui.collect_field ? (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] h-5 px-1.5 font-medium border-border/80 text-muted-foreground"
                                        >
                                          {ui.collect_field.required_for_apply === false
                                            ? 'Optional'
                                            : 'Required for search'}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <div className="flex gap-3 items-start">
                                    <div
                                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-border/60"
                                      aria-hidden
                                    >
                                      <Sparkles className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <div className="rounded-2xl rounded-tl-md border border-border/50 bg-muted/30 px-4 py-3 text-sm shadow-sm">
                                        <p className="whitespace-pre-wrap text-foreground leading-relaxed">{prose}</p>
                                        {msg.role === 'assistant' &&
                                        ui?.phase === 'collect_field' &&
                                        ui.collect_field ? (
                                          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                                            {ui.collect_field.input_kind === 'single_choice' &&
                                            ui.collect_field.options.length > 0 ? (
                                              <div
                                                className="flex flex-wrap gap-1.5"
                                                role="radiogroup"
                                                aria-label="Pick one option"
                                              >
                                                {ui.collect_field.options.map((o) => {
                                                  const selected = plannerInput.trim() === o.id;
                                                  return (
                                                    <button
                                                      key={o.id}
                                                      type="button"
                                                      disabled={
                                                    plannerLoading ||
                                                    plannerHostState.phase === 'review' ||
                                                    plannerHostState.phase === 'running' ||
                                                    plannerHostState.phase === 'optional_prompt'
                                                  }
                                                      onClick={() => setPlannerInput(o.id)}
                                                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                                                        selected
                                                          ? 'border-primary bg-primary/15 text-foreground font-medium'
                                                          : 'border-border/60 bg-background/60 hover:bg-muted/60 text-muted-foreground'
                                                      }`}
                                                    >
                                                      {o.label}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            ) : ui.collect_field.input_kind === 'multi_choice' &&
                                              ui.collect_field.options.length > 0 ? (
                                              <div className="flex flex-wrap gap-1.5">
                                                {ui.collect_field.options.map((o) => (
                                                  <button
                                                    key={o.id}
                                                    type="button"
                                                    disabled={
                                                    plannerLoading ||
                                                    plannerHostState.phase === 'review' ||
                                                    plannerHostState.phase === 'running' ||
                                                    plannerHostState.phase === 'optional_prompt'
                                                  }
                                                    onClick={() =>
                                                      setPlannerInput((prev) => {
                                                        const parts = prev
                                                          .split(',')
                                                          .map((s) => s.trim())
                                                          .filter(Boolean);
                                                        if (parts.includes(o.id)) return prev;
                                                        return prev.trim() ? `${prev}, ${o.id}` : o.id;
                                                      })
                                                    }
                                                    className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] hover:bg-muted/60 disabled:opacity-50"
                                                  >
                                                    {o.label}
                                                  </button>
                                                ))}
                                              </div>
                                            ) : null}
                                            {ui.collect_field.allow_custom_text ? (
                                              <p className="text-[10px] text-muted-foreground pt-1">
                                                {ui.collect_field.required_for_apply === false
                                                  ? 'Optional — leave blank and send to skip, or pick a shortcut / type below.'
                                                  : 'Pick a shortcut or type your answer below (needed to apply this plan).'}
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : null}
                                        {msg.role === 'assistant' &&
                                        ui?.phase === 'review' &&
                                        ui.review?.summary?.length ? (
                                          <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
                                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                              Summary (field → value)
                                            </p>
                                            <ul className="text-xs space-y-1">
                                              {ui.review.summary.map((row) => (
                                                <li key={row.field_id} className="flex items-start justify-between gap-2">
                                                  <span className="min-w-0">
                                                    <span className="font-mono text-[10px] text-muted-foreground">
                                                      {row.field_id}
                                                    </span>
                                                    {' → '}
                                                    <span>{row.display}</span>
                                                  </span>
                                                  {plannerUseHostFlow ? (
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-6 text-[10px] shrink-0 px-1.5"
                                                      onClick={() => handlePlannerEditField(row.field_id)}
                                                    >
                                                      Edit
                                                    </Button>
                                                  ) : null}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ) : msg.role === 'assistant' &&
                                          msg.planComplete &&
                                          msg.fieldSummary &&
                                          !ui?.review ? (
                                          <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
                                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                              Summary (field → value)
                                            </p>
                                            <ul className="text-xs space-y-1">
                                              {Object.entries(msg.fieldSummary).map(([k, v]) => (
                                                <li key={k}>
                                                  <span className="font-mono text-[10px] text-muted-foreground">{k}</span>
                                                  {' → '}
                                                  <span>
                                                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                  </span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ) : null}
                                      </div>
                                      {msg.createdAt ? (
                                        <p className="text-[10px] text-muted-foreground px-0.5">
                                          {formatPlannerTimestamp(msg.createdAt)}
                                        </p>
                                      ) : null}
                                      {msg.role === 'assistant' &&
                                      ui?.phase === 'pick_filter' &&
                                      ui.pick_filter?.options?.length ? (
                                        <PlannerFilterCards
                                          options={ui.pick_filter.options.map((o) => ({
                                            id: o.id,
                                            label: o.label,
                                            description: o.description,
                                            iconHint: o.iconHint,
                                            group: o.group,
                                          }))}
                                          onPick={(id) => void handlePlannerCatalogPick(id)}
                                          disabled={
                                            plannerLoading ||
                                            plannerHostState.phase === 'review' ||
                                            plannerHostState.phase === 'running' ||
                                            plannerHostState.phase === 'optional_prompt'
                                          }
                                        />
                                      ) : null}
                                      {msg.role === 'assistant' && msg.planComplete && (
                                        <div className="flex flex-wrap items-center gap-1.5 px-0.5 pt-0.5">
                                          <Badge variant="secondary" className="text-[10px] h-5">
                                            Review
                                          </Badge>
                                          {msg.suggestedTab && (
                                            <span className="text-[10px] text-muted-foreground">
                                              Suggested tab:{' '}
                                              {msg.suggestedTab === 'prospect-search'
                                                ? 'Brivano Lens'
                                                : msg.suggestedTab === 'search'
                                                  ? 'Search'
                                                  : msg.suggestedTab === 'real-estate'
                                                    ? 'Real Estate'
                                                    : 'AI Assistant'}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {msg.role === 'assistant' && msg.appliedFilters && (
                                        <div className="flex items-center gap-1.5 flex-wrap px-0.5">
                                          <Target className="h-3 w-3 text-primary flex-shrink-0" />
                                          <span className="text-[10px] text-primary font-medium">Lens filters in plan</span>
                                          {Object.entries(msg.appliedFilters)
                                            .filter(([_, v]) =>
                                              Array.isArray(v) ? v.length > 0 : v != null && v !== '',
                                            )
                                            .map(([k]) => (
                                              <Badge key={k} variant="secondary" className="text-[9px] px-1.5 py-0">
                                                {k.replace(/([A-Z])/g, ' $1').trim()}
                                              </Badge>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {plannerLoading && (
                          <div className="flex gap-3 items-start max-w-3xl mx-auto pt-1">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border/50">
                              <Sparkles className="h-4 w-4 text-muted-foreground animate-pulse" />
                            </div>
                            <div className="rounded-2xl rounded-tl-md border border-border/50 bg-muted/40 px-4 py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>

                  {plannerMessages.length > 0 && (
                    <div className="border-t border-border/50 bg-muted/10 p-4 space-y-2">
                      {plannerUseHostFlow && plannerHostState.phase === 'review' ? (
                        <div className="max-w-3xl mx-auto space-y-3">
                          <p className="text-xs text-muted-foreground text-center">
                            Review the summary above. Search runs only after you confirm—not automatically.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={handlePlannerReviewBack}>
                              Back
                            </Button>
                            <Button type="button" size="sm" onClick={handlePlannerApplyPlan} className="gap-1.5">
                              <Check className="h-3.5 w-3.5" />
                              Run Search
                            </Button>
                          </div>
                        </div>
                      ) : plannerUseHostFlow && plannerHostState.phase === 'optional_prompt' ? (
                        <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
                          <Button type="button" variant="outline" size="sm" onClick={handlePlannerOptionalRunNow}>
                            Run Search Now
                          </Button>
                          <Button type="button" size="sm" onClick={handlePlannerOptionalAddFilters}>
                            Add Optional Filters
                          </Button>
                        </div>
                      ) : plannerUseHostFlow &&
                        (plannerHostState.phase === 'collecting_required' ||
                          plannerHostState.phase === 'collecting_optional') ? (
                        <>
                          <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto pb-1">
                            {(() => {
                              const cid = getCurrentFieldId(plannerHostState);
                              const sf =
                                cid && plannerHostState.selectedType
                                  ? getPlannerField(plannerHostState.selectedType, cid)
                                  : undefined;
                              return (
                                <>
                                  {plannerHostState.phase === 'collecting_optional' && sf?.required === false ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={handlePlannerSkipOptional}
                                    >
                                      Skip (optional)
                                    </Button>
                                  ) : null}
                                  {plannerHostState.committedKeys.length > 0 ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={handlePlannerBack}
                                    >
                                      Back
                                    </Button>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                          <div className="flex gap-2 max-w-3xl mx-auto items-stretch">
                            <Textarea
                              placeholder="Type your answer..."
                              value={plannerInput}
                              onChange={(e) => setPlannerInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handlePlannerSend();
                                }
                              }}
                              className="min-h-[48px] max-h-[120px] resize-none text-sm rounded-xl border-border/60 bg-background"
                              rows={2}
                              disabled={plannerLoading}
                            />
                            <Button
                              type="button"
                              onClick={() => handlePlannerSend()}
                              disabled={
                                plannerLoading ||
                                (() => {
                                  const cid = getCurrentFieldId(plannerHostState);
                                  const sf =
                                    cid && plannerHostState.selectedType
                                      ? getPlannerField(plannerHostState.selectedType, cid)
                                      : undefined;
                                  const empty = !plannerInput.trim();
                                  const ph = plannerHostState.phase;
                                  const needInput =
                                    ph === 'collecting_required' || sf?.required === true;
                                  return empty && needInput;
                                })()
                              }
                              size="sm"
                              className="h-auto min-h-[48px] px-5 shrink-0 rounded-xl gap-2"
                            >
                              <Send className="h-4 w-4" />
                              Send
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center max-w-3xl mx-auto pt-0.5">
                            You can always type a custom answer; quick picks are shortcuts.
                          </p>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Real Estate Tab ── */}
          <TabsContent value="real-estate" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">FSBO & FRBO Listing Scraper</h3>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Find For Sale / For Rent By Owner listings across Zillow, Apartments.com, HotPads, Trulia, Redfin, and more
                </p>

                <div className="flex gap-3 items-end">
                  <div className="w-64 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">City</Label>
                    <Input
                      value={reLocation}
                      onChange={(e) => setReLocation(e.target.value)}
                      placeholder="e.g. Chicago or Chicago, Illinois"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="w-40 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Platform</Label>
                    <Select value={rePlatform} onValueChange={handleRealEstatePlatformChange}>
                      {/* Only SelectValue in trigger: Radix clones ItemText (icon + label). A second PlatformMark here duplicated icons and could desync. */}
                      <SelectTrigger className="h-9 text-sm [&>span]:line-clamp-none">
                        <SelectValue placeholder="Platform" className="min-w-0 flex-1 text-left" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <span className="flex items-center gap-2">All Platforms</span>
                        </SelectItem>
                        {Object.entries(PLATFORM_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <PlatformMark
                                logoSrc={config.logo}
                                fallbackLetter={config.domain}
                                title={config.label}
                              />
                              {config.label}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                  <Button onClick={handleRealEstateScrape} disabled={reLoading} size="sm" className="h-9 px-4">
                    {reLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-3.5 w-3.5 mr-1.5" /> Find Listings</>}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={reSaveToDb} onCheckedChange={setReSaveToDb} className="scale-90" />
                    <span className="text-xs font-medium">Save to Database</span>
                  </label>
                </div>

              {/* Backend status, cap verification, and PM/realtor filter note */}
              <div className="flex items-center gap-2 pt-1.5 text-[11px] text-muted-foreground flex-wrap">
                <span className="text-green-600 dark:text-green-400 font-medium">No listing cap</span>
                <span>— scope below controls whether PM/managed rows are saved and shown.</span>
                {reByOwnerStrict ? (
                  <>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">By-owner only</span>
                    <span>
                      — Zillow FRBO selects this automatically (filters PM/leasing on save). Other platforms: turn on here for the same behavior.
                      {reListings.length > 0
                        ? ' Need every row? Choose Include PM / realtor next to Match, then Refresh.'
                        : ' Use the scope buttons next to Refresh (empty-state card below), then Refresh again.'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Include PM / realtor</span>
                    <span>
                      — saves and shows managed buildings and broker contacts. This is the default for every platform except Zillow FRBO (FRBO defaults to by-owner when you pick it).
                      {reListings.length > 0
                        ? ' For private landlords only on non-FRBO scrapers, choose By-owner only next to Match, then run Find Listings again or Refresh.'
                        : ' Scope buttons sit next to Refresh below (and next to Match after rows load).'}
                    </span>
                  </>
                )}
                {reBackendCheckInProgress && <span>Checking backend…</span>}
                {!reBackendCheckInProgress && reBackendReachable === true && (() => {
                  const base = scraperBackendApi.getBaseUrl();
                  const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
                  const localLabel = base.replace(/^https?:\/\//, '');
                  return (
                    <span className="flex flex-col gap-0.5">
                      <span>
                        {isLocal ? <>Local backend (<span className="font-mono" title={base}>{localLabel}</span>): </> : <>Backend: <span className="font-mono truncate max-w-[200px] inline-block align-bottom" title={base}>{base.replace(/^https?:\/\//, '')}</span> — </>}
                        <span className="text-green-600 dark:text-green-400">{isLocal ? 'Running' : 'Reachable'}</span>
                      </span>
                      {reLiveScrapeReady === false && (
                        <span className="text-amber-700 dark:text-amber-400 text-[10px]">
                          Live scrape unavailable — update ZYTE_API_KEY in Omar_bucio_backend_Scraper/.env and restart the backend.
                        </span>
                      )}
                    </span>
                  );
                })()}
                {!reBackendCheckInProgress && reBackendReachable === false && (() => {
                  const base = scraperBackendApi.getBaseUrl();
                  const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
                  return (
                    <span className="flex items-center gap-2 flex-wrap">
                      <span>
                        {isLocal
                          ? <>Local backend not running. Start it with: <span className="font-mono">python api_server.py</span> (port 8080).</>
                          : <>Backend: <span className="font-mono truncate max-w-[200px] inline-block align-bottom" title={base}>{base.replace(/^https?:\/\//, '')}</span> — <span className="text-destructive">Not reachable.</span> Check Railway or network.</>}
                      </span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={checkReBackendReachable}>Retry</Button>
                    </span>
                  );
                })()}
              </div>
              
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Address', 'Beds', 'Baths', 'Price', 'Days on Market', 'Favorites', 'Views', 'Owner Name', 'Owner Phone', 'Owner Email', 'Source'].map(field => (
                    <span key={field} className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">{field}</span>
                  ))}
                </div>
              </CardContent>
            </Card>


            {isAdmin && reErrors.length > 0 && (
              <div className="px-4 py-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs">
                <p className="font-medium text-destructive mb-1">Some sites couldn't be scraped:</p>
                    {reErrors.map((err, i) => (
                  <p key={i} className="text-muted-foreground truncate">• {err.url}: {err.error}</p>
                    ))}
                </div>
              )}

          {reListings.length === 0 && (
            <Card className="border-dashed border-border/80 bg-muted/15">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-muted-foreground max-w-2xl">
                  {rePlatform === 'all' ? (
                    <>
                      Pick a single platform (not &quot;All&quot;), enter a city, then click{' '}
                      <span className="font-medium text-foreground">Find Listings</span>.
                    </>
                  ) : reLoading || reScrapeLiveDisplay ? (
                    <>
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        Searching listings for {reLocation.trim() || 'your area'}… This can take a few minutes on Apartments.com.
                      </span>
                      <span className="block mt-2 text-muted-foreground">
                        Rows appear here as they are found during the search, then saved when it finishes. Use <span className="font-medium text-foreground">Include PM / realtor</span> for Apartments.com.
                      </span>
                    </>
                  ) : (
                    <>
                      Nothing loaded yet. Click <span className="font-medium text-foreground">Find Listings</span> or{' '}
                      <span className="font-medium text-foreground">Refresh listings</span> to search this city.
                      Use the format <span className="font-medium text-foreground">City, ST</span> (e.g. Phoenix, AZ).
                      {reByOwnerStrict && (
                        <span className="block mt-2 text-amber-600/95 dark:text-amber-400/95">
                          <span className="font-medium">By-owner only</span> is on — if the database has rows but you see none, choose{' '}
                          <span className="font-medium text-foreground">Include PM / realtor</span> next to Refresh, then Refresh again.
                        </span>
                      )}
                    </>
                  )}
                </p>
                {rePlatform !== 'all' && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0">
                    {renderListingScopeToolbar()}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2 shrink-0 gap-1"
                      disabled={reRefreshingListings}
                      onClick={() => void refreshListingsFromBackend()}
                    >
                      {reRefreshingListings ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Refresh listings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {reListings.length > 0 && (
              <>
                {/* Map / List Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <Button 
                      variant={showMap ? "default" : "outline"}
                        size="sm" 
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setShowMap(true)}
                    >
                      <MapPin className="h-3 w-3" /> Map View
                      </Button>
                      <Button 
                      variant={!showMap ? "default" : "outline"}
                        size="sm" 
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setShowMap(false)}
                    >
                      <Building className="h-3 w-3" /> List View
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end max-w-full">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={reMatchLocationFilter ? 'outline' : 'default'}
                        className="h-7 text-[10px] px-2"
                        onClick={() => {
                          setReMatchLocationFilter(false);
                          if (rePlatform !== 'all') {
                            void fetchLastResultForPlatform(rePlatform, {
                              includePm: !reByOwnerStrict,
                              allCities: true,
                            });
                          }
                        }}
                        title="Load all saved rows for this platform (every city)"
                      >
                        Show all rows ({reShownWithoutLocationFilter})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={reMatchLocationFilter ? 'default' : 'outline'}
                        className="h-7 text-[10px] px-2"
                        disabled={!reLocation?.trim()}
                        onClick={() => {
                          setReMatchLocationFilter(true);
                          if (rePlatform !== 'all' && reLocation?.trim()) {
                            void fetchLastResultForPlatform(rePlatform, buildLastResultFetchOpts());
                          }
                        }}
                        title="Only listings matching the city in the search box"
                      >
                        Match &quot;{reLocation?.trim() || 'location'}&quot;
                      </Button>
                      {renderListingScopeToolbar()}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2 gap-1"
                        disabled={reRefreshingListings || rePlatform === 'all'}
                        onClick={() => void refreshListingsFromBackend()}
                        title="Load saved rows for this city from Supabase, or start a live Zyte scrape if none are saved yet."
                      >
                        {reRefreshingListings ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Refresh listings
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-[10px] text-muted-foreground text-right">
                        {reListingsFilteredForDisplay.length} listing{reListingsFilteredForDisplay.length !== 1 ? 's' : ''} shown
                        {reMatchLocationFilter && reLocation?.trim() && (
                          <span title="By-owner vs Include PM changes how many rows load from the API; Match city then keeps only addresses that match this search box.">
                            {' '}
                            · Match &quot;{reLocation.trim()}&quot;:{' '}
                            <span className="text-foreground/90 font-medium">{reListingsFilteredForDisplay.length}</span>
                            {' of '}
                            <span className="text-foreground/90 font-medium">{reShownWithoutLocationFilter}</span>
                            {' before city filter'}
                            {reListings.length !== reShownWithoutLocationFilter ? (
                              <span> ({reListings.length} raw in memory)</span>
                            ) : null}
                          </span>
                        )}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal text-green-600 dark:text-green-400 border-green-500/50" title="Backend returns all scraped listings with no limit">
                        No cap
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-normal border-amber-500/50 ${reBackendPmIncludedFromApi ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}
                        title={
                          reBackendPmIncludedFromApi
                            ? 'Last /last-result used include_pm=1 (all saved rows).'
                            : 'Last /last-result omitted PM/managed-pattern rows (by-owner request).'
                        }
                      >
                        {reBackendPmIncludedFromApi ? 'Backend: PM included' : 'Backend: by-owner only'}
                      </Badge>
                      {reMatchLocationFilter && reLocation?.trim() && (
                        <Badge variant="outline" className="text-[10px] font-normal text-sky-600 dark:text-sky-400 border-sky-500/50" title="Only rows whose address matches the City field">
                          City: {reLocation.trim()}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-green-600/90 dark:text-green-400/90 text-right" title="Rows currently loaded from the last scrape or refresh">
                      {reBackendRowCountForPlatform} loaded from backend{reMatchLocationFilter ? '' : ' — table not filtered by search box'}
                    </span>
                    <span
                      className={`text-[10px] text-right max-w-xl ${reBackendPmIncludedFromApi ? 'text-blue-600/90 dark:text-blue-400/90' : 'text-amber-600/90 dark:text-amber-400/90'}`}
                    >
                      {reBackendPmIncludedFromApi
                        ? 'PM included — click By-owner only to refetch with PM/managed rows hidden on the backend.'
                        : 'By-owner only — need the full database? Click Include PM / realtor (refetches with all rows).'}
                      {(rePlatform === 'zillow_frbo' || rePlatform === 'hotpads' || rePlatform === 'trulia') &&
                        reMatchLocationFilter &&
                        reLocation?.trim() && (
                        <span className="block mt-1 text-muted-foreground font-normal">
                          <strong className="text-foreground/85 font-medium">Why the list can look identical:</strong> (1){' '}
                          <span className="text-foreground/80">Match &quot;{reLocation.trim()}&quot;</span> keeps only addresses that match this city — most saved rows may be other metros, so both Include PM and By-owner can show the same small subset (e.g. 11 of 136). Compare{' '}
                          <span className="text-foreground/80 font-medium">… of M before city filter</span>: M should drop when By-owner strips MLS/PM rows. (2) If{' '}
                          <span className="text-foreground/80 font-medium">M</span> never changes, the backend did not classify those rows as PM, or both API loads returned the same set.
                          {rePlatform === 'hotpads' && (
                            <span className="block mt-1">
                              <strong className="text-foreground/85 font-medium">Hotpads:</strong> most rows use{' '}
                              <span className="text-foreground/80">support@hotpads.com</span> — that is normal masking, not auto-PM. By-owner hides{' '}
                              <span className="text-foreground/80">hp_strict_signal=managed</span>, Hotpads building URLs (<span className="text-foreground/80">/b/pad</span>, <span className="text-foreground/80">/building/</span>, or <span className="text-foreground/80">…/property-slug/pad</span> without a unit number), LLC/Inc-style lister names, and other PM/corporate patterns. Use{' '}
                              <span className="text-foreground/80">Include PM / realtor</span> for the full feed.{' '}
                              <span className="text-foreground/80">Include PM</span> sorts PM/corporate-style rows first;{' '}
                              <span className="text-foreground/80">by-owner</span> sorts unmasked personal email first — so the top of the list should not match between the two toggles.
                            </span>
                          )}
                          {rePlatform === 'trulia' && (
                            <span className="block mt-1">
                              <strong className="text-foreground/85 font-medium">Trulia:</strong> each row shows an{' '}
                              <span className="text-foreground/80">Owner / Managed / Unknown</span> badge from{' '}
                              <span className="text-foreground/80">trulia_strict_signal</span> (saved after scrape or inferred on refresh).{' '}
                              <span className="text-foreground/80">Managed</span> or MLS-style copy means not client FSBO;{' '}
                              <span className="text-foreground/80">Owner</span> is the FSBO-style signal.{' '}
                              <span className="text-foreground/80">Unknown</span> with By-owner still visible means the row passed text heuristics — open the Trulia link to confirm.
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Map */}
                {showMap && (
                  <Suspense fallback={<div className="h-[400px] rounded-lg bg-muted/30 border border-border/60 flex items-center justify-center text-xs text-muted-foreground">Loading map...</div>}>
                    <ListingsMap
                      listings={reListingsFilteredForDisplay.map(({ listing }) => listing)}
                      onSelectListing={() => {
                        setShowMap(false);
                      }}
                      searchLocation={reLocation}
                      resolveListingAddress={resolveListingAddressForMap}
                    />
                  </Suspense>
                )}

              <Card className="border-border/60">
                {reListings.length > 0 && reListingsFilteredForDisplay.length === 0 && (
                  <div className="px-5 py-2.5 border-b border-amber-500/25 bg-amber-500/[0.06] text-[11px] text-amber-900 dark:text-amber-100/95">
                    <span className="font-medium">0 listings match your current filters.</span> {reListings.length} row
                    {reListings.length !== 1 ? 's are' : ' is'} loaded but hidden by By-owner rules and/or city match. Try{' '}
                    <span className="font-medium">Include PM / realtor</span> next to Refresh, turn off <span className="font-medium">Match city</span>, or click{' '}
                    <span className="font-medium">Show all rows</span>.
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{reListingsFilteredForDisplay.length} Listings</h3>
                    <Badge variant="outline" className="text-[10px] font-normal text-green-600 dark:text-green-400 border-green-500/50" title="All scrapers return unlimited listings; no 500 cap">
                      No cap
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-normal border-amber-500/50 ${reByOwnerStrict ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}
                      title={
                        reByOwnerStrict
                          ? 'Table hides PM/broker-style names. If skip trace returns an assessor/agency name, we keep the listing contact on the card so the row stays visible.'
                          : 'Table shows all loaded owner names (no client-side by-owner name filter).'
                      }
                    >
                      {reByOwnerStrict ? 'Table: by-owner only' : 'Table: all names'}
                    </Badge>
                    {reLastBackendPmMeta && rePlatform !== 'all' && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-normal max-w-[280px] whitespace-normal h-auto py-0.5 leading-snug ${
                          reLastBackendPmMeta.include_pm
                            ? 'text-sky-700 dark:text-sky-300 border-sky-500/45'
                            : reLastBackendPmMeta.pm_rows_hidden > 0
                              ? 'text-violet-700 dark:text-violet-300 border-violet-500/45'
                              : 'text-muted-foreground border-border/60'
                        }`}
                        title={
                          reLastBackendPmMeta.include_pm
                            ? 'Last API load used include_pm=1: every saved row for this platform.'
                            : reLastBackendPmMeta.pm_rows_hidden > 0
                              ? 'Backend removed rows classified as PM/realtor/managed before sending to the app.'
                              : 'No saved rows matched PM/broker patterns (common on Trulia when description/agent fields are empty). Re-scrape with an updated spider; until then By-owner and Include PM show the same set.'
                        }
                      >
                        {reLastBackendPmMeta.include_pm
                          ? `DB ${reLastBackendPmMeta.total_stored} saved (full load)`
                          : reLastBackendPmMeta.pm_rows_hidden > 0
                            ? `+${reLastBackendPmMeta.pm_rows_hidden} rows only in Include PM · ${reLastBackendPmMeta.total_stored} in DB`
                            : `No PM match in DB · ${reLastBackendPmMeta.total_stored} rows`}
                      </Badge>
                    )}
                    {reMatchLocationFilter && reLocation?.trim() && (
                      <Badge variant="outline" className="text-[10px] font-normal text-sky-600 dark:text-sky-400 border-sky-500/50">
                        City: {reLocation.trim()}
                      </Badge>
                    )}
                    {reMatchLocationFilter && reLocation?.trim() && reListingsFilteredForDisplay.length < reShownWithoutLocationFilter && (
                      <span className="text-[10px] text-muted-foreground">(city filter on)</span>
                    )}
                    {!reMatchLocationFilter && reLocation?.trim() && (
                      <span className="text-[10px] text-muted-foreground">(all cities)</span>
                    )}
                    {selectedListings.size > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">{selectedListings.size} selected</Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={toggleSelectAllListings}>
                      {selectedListings.size === filteredUnsavedIndices.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    {selectedListings.size > 0 && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={handleBulkSkipTrace} disabled={bulkSkipTracing}>
                          {bulkSkipTracing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCw className="h-3 w-3 mr-1" /> Skip Trace</>}
                        </Button>
                      </>
                    )}
                    {selectedListings.size > 0 && (
                      <>
                        <Button size="sm" className="h-7 text-xs px-2.5" onClick={handleBulkSave} disabled={bulkSaving}>
                          {bulkSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" /> Save</>}
                      </Button>
                    </>
                  )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={exportListingsToCSV}>
                      <Download className="h-3 w-3 mr-1" /> CSV
                  </Button>
                </div>
                </div>
                <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-border/40">
                    {reListingsFilteredForDisplay.map(({ listing, realIndex }) => (
                      <div 
                        key={realIndex} 
                          className={`px-5 py-3.5 flex gap-3 transition-colors hover:bg-muted/30 ${
                            selectedListings.has(realIndex) ? 'bg-primary/[0.03]' : ''
                          } ${listing.saved_to_db ? 'opacity-50' : ''}`}
                        >
                          {!listing.saved_to_db ? (
                            <Checkbox checked={selectedListings.has(realIndex)} onCheckedChange={() => toggleListingSelection(realIndex)} className="mt-0.5" />
                          ) : (
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          )}
                          
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {getListingViewUrl(listing) ? (
                                    <a href={getListingViewUrl(listing) || '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate hover:text-primary hover:underline block min-w-0">
                                      {listingDisplayAddress(listing)}
                                    </a>
                                  ) : (
                                    <h4 className="text-sm font-medium truncate">{listingDisplayAddress(listing)}</h4>
                                  )}
                                  {listing.saved_to_db && <Badge variant="secondary" className="text-[10px] h-4 shrink-0">Saved</Badge>}
                                  {listing.skip_trace_status === 'success' && (
                                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] h-4 border-0 shrink-0">Traced</Badge>
                                  )}
                                  {listing.skip_trace_status === 'not_found' && (
                                    <Badge variant="outline" className="text-[10px] h-4 shrink-0">Not Found</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {[listing.property_type, listing.bedrooms && `${listing.bedrooms} bed`, listing.bathrooms && `${listing.bathrooms} bath`, listing.square_feet && `${listing.square_feet.toLocaleString()} sqft`].filter(Boolean).join(' · ')}
                                </p>
                                {listingCity(listingDisplayAddress(listing)) && (
                                  <p className="text-[11px] text-muted-foreground/90 mt-0.5">
                                    City: {listingCity(listingDisplayAddress(listing))}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                <p className="text-sm font-semibold">{listing.price ? (String(listing.price).startsWith('$') ? listing.price : `$${listing.price}`) : '—'}</p>
                                {listing.days_on_market && <p className="text-[10px] text-muted-foreground">{listing.days_on_market}d on market</p>}
                                {getListingViewUrl(listing) && (
                                  <a href={getListingViewUrl(listing) || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 hover:underline" title="Open this listing in a new tab">
                                    View listing <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                  </a>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {listing.favorites_count !== undefined && <span>♡ {listing.favorites_count}</span>}
                              {listing.views_count !== undefined && <span>👁 {listing.views_count}</span>}
                              {listing.source_platform && (
                                <span className="flex items-center gap-1">
                                  <ListingSourcePlatformMark
                                    sourcePlatform={listing.source_platform}
                                    sourceUrl={listing.source_url}
                                  />
                                  <Badge variant="outline" className="text-[10px] h-4 font-normal">{listing.source_platform}</Badge>
                                </span>
                              )}
                              {listing.listing_type && <Badge variant="secondary" className="text-[10px] h-4 font-normal uppercase">{listing.listing_type}</Badge>}
                              {listing.source_platform === 'trulia' && (() => {
                                const sig = String((listing as { trulia_strict_signal?: string | null }).trulia_strict_signal || '')
                                  .trim()
                                  .toLowerCase();
                                const label =
                                  sig === 'owner'
                                    ? 'Owner'
                                    : sig === 'managed'
                                      ? 'Managed'
                                      : 'Unknown';
                                const title =
                                  sig === 'owner'
                                    ? 'Trulia strict signal: owner / FSBO-style (from scrape or API inference)'
                                    : sig === 'managed'
                                      ? 'Trulia strict signal: MLS or agent-marketed'
                                      : 'No trulia_strict_signal in DB — API may still infer on refresh; confirm on Trulia';
                                const cls =
                                  sig === 'owner'
                                    ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/50'
                                    : sig === 'managed'
                                      ? 'text-orange-700 dark:text-orange-400 border-orange-500/50'
                                      : 'text-muted-foreground border-border';
                                return (
                                  <Badge variant="outline" className={`text-[10px] h-4 font-normal ${cls}`} title={title}>
                                    Trulia: {label}
                                  </Badge>
                                );
                              })()}
                            </div>

                            {(listing.owner_name || listing.owner_phone || listing.owner_email) ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-4 text-xs bg-muted/40 rounded-md px-3 py-2">
                                  {listing.owner_name && <span className="font-medium">{listing.owner_name}</span>}
                                  {listing.owner_phone && (
                                    <a href={`tel:${String(listing.owner_phone).replace(/\D/g, '')}`} className="flex items-center gap-1 text-primary hover:underline">
                                      <PhoneIcon className="h-3 w-3" /> {formatUsPhoneForDisplay(String(listing.owner_phone))}
                                    </a>
                                  )}
                                  {listing.owner_email && (
                                    <a href={`mailto:${listing.owner_email}`} className="flex items-center gap-1 text-primary hover:underline">
                                      <MailIcon className="h-3 w-3" /> {listing.owner_email}
                                    </a>
                                  )}
                                </div>
                                {listing.skip_trace_assessor_name &&
                                  listing.skip_trace_assessor_name.trim().toLowerCase() !==
                                    String(listing.owner_name || '').trim().toLowerCase() && (
                                    <p className="text-[10px] text-muted-foreground/90 px-1">
                                      Assessor / skip-trace record: {listing.skip_trace_assessor_name}
                                    </p>
                                  )}
                              </div>
                            ) : null}

                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`h-7 text-xs shrink-0${listing.skip_trace_status === 'not_found' ? ' text-orange-600 border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-950/20' : ''}`}
                                  title={
                                    addressForSkipTrace(listing)
                                      ? listing.skip_trace_status === 'success'
                                        ? 'Run skip trace again (refreshes BatchData and listing contact where applicable)'
                                        : listing.skip_trace_status === 'not_found'
                                          ? 'Retry skip trace after fixing address or when listing adds a phone'
                                          : 'Look up owner / contact for this address'
                                      : 'No usable address for skip trace — fix address or open listing URL'
                                  }
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleSkipTraceListing(listing, realIndex)}
                                  disabled={skipTracingIndex === realIndex || !addressForSkipTrace(listing)}
                                >
                                  {skipTracingIndex === realIndex ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCw className="h-3 w-3 mr-1" />}
                                  Skip Trace
                                </Button>
                                {!listing.saved_to_db && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 text-xs shrink-0"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleSaveListing(listing, realIndex)}
                                  disabled={savingIndex === realIndex}
                                >
                                  {savingIndex === realIndex ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
                                  </Button>
                                )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
              </>
          )}
        </TabsContent>

          <TabsContent value="job-scraper" className="space-y-4 mt-0">
            <GoogleJobsScraper />
          </TabsContent>

          {/* ── Search Tab — Clay-like Rich Interface ── */}
          <TabsContent value="search" className="space-y-4 mt-0">
            {/* Search Command Bar */}
            <Card className="border-border/40 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/[0.04] to-transparent">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Search className="h-4 w-4 text-primary" />
              </div>
                <div>
                      <h3 className="text-sm font-semibold">Search & Discover</h3>
                      <p className="text-[10px] text-muted-foreground">Search the web to find and import business leads</p>
                </div>
                </div>

                  {/* Search Categories */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: "All", value: "all" as const, icon: Search },
                      { label: "Companies", value: "companies" as const, icon: Building },
                      { label: "People", value: "people" as const, icon: UserPlus },
                      { label: "Local", value: "local" as const, icon: MapPin },
                    ].map(cat => {
                      const isSelected = searchCategory === cat.value;
                      return (
                        <button
                          key={cat.label}
                          type="button"
                          onClick={() => setSearchCategory(cat.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border/60 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <cat.icon className="h-3 w-3" />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Main Search Input */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                        placeholder="Search for businesses, companies, or people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                        className="h-10 pl-10 text-sm bg-background border-border/60 focus-visible:ring-primary/30"
                />
              </div>
                    <div className="w-20">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={searchLimit}
                  onChange={(e) => setSearchLimit(parseInt(e.target.value) || 10)}
                        className="h-10 text-sm text-center"
                        title="Max results"
                />
              </div>
                    <Button onClick={handleSearch} disabled={searchLoading} className="h-10 px-5 gap-2">
                      {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-3.5 w-3.5" /> Search</>}
              </Button>
                  </div>

                  {/* Quick Search Suggestions */}
                  {searchResults.length === 0 && !searchLoading && (
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Roofing companies in Dallas TX",
                        "SaaS startups San Francisco",
                        "HVAC contractors Miami",
                        "Dentists near Chicago IL",
                        "Real estate agents Austin",
                        "Marketing agencies NYC",
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => { setSearchQuery(suggestion); }}
                          className="px-2.5 py-1 rounded-md bg-muted/50 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
            </CardContent>
              </div>
          </Card>

            {/* Results Table */}
          {searchResults.length > 0 && (
              <Card className="border-border/40">
                {/* Results Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold">{searchResults.length} Results</h3>
                    {selectedResults.size > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">{selectedResults.size} selected</Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={toggleSelectAll}>
                    {selectedResults.size === searchResults.filter(r => !r.imported).length ? 'Deselect All' : 'Select All'}
                  </Button>
                    <Button size="sm" className="h-7 text-[11px] gap-1.5" onClick={importSelectedLeads} disabled={selectedResults.size === 0 || bulkImporting}>
                      {bulkImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                      Import {selectedResults.size > 0 ? `(${selectedResults.size})` : ''}
                  </Button>
                </div>
                </div>
                <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                        <tr className="border-b border-border/40">
                          <th className="w-10 px-4 py-2.5 text-left">
                            <Checkbox
                              checked={selectedResults.size === searchResults.filter(r => !r.imported).length && searchResults.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Source</th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Preview</th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                          <th className="w-24 px-3 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((result, i) => {
                          let domain = '';
                          try { domain = new URL(result.url).hostname.replace('www.', ''); } catch {}
                          const domainInitial =
                            domain && /^[a-z0-9]/i.test(domain) ? domain.charAt(0).toUpperCase() : (result.title || '?').charAt(0).toUpperCase();
                          return (
                            <tr
                              key={i}
                              className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${
                                result.imported ? 'opacity-50' : ''
                              } ${selectedResults.has(i) ? 'bg-primary/[0.03]' : ''}`}
                            >
                              <td className="px-4 py-3">
                                {!result.imported ? (
                                  <Checkbox checked={selectedResults.has(i)} onCheckedChange={() => toggleSelectResult(i)} />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                )}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-3 max-w-[300px]">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className="h-5 w-5 rounded-sm shrink-0 bg-muted flex items-center justify-center"
                                    title={domain || undefined}
                                  >
                                    <span className="text-[9px] font-bold text-muted-foreground">{domainInitial}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:text-primary hover:underline truncate block">
                                {result.title}
                              </a>
                                    <p className="text-[10px] text-muted-foreground truncate">{domain}</p>
                            </div>
                          </div>
                              </td>
                              <td className="px-3 py-3 max-w-[300px]">
                                <p className="text-[11px] text-muted-foreground line-clamp-2">{result.description || '—'}</p>
                              </td>
                              <td className="px-3 py-3">
                                {result.imported ? (
                                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0 text-[10px] h-5">Imported</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] h-5 font-normal">New</Badge>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-0.5">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(result.markdown || result.url)} title="Copy">
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(result.url, '_blank')} title="Open">
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                  {!result.imported && (
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-primary" onClick={() => importAsLead(result, i)} disabled={importingIndex === i} title="Import as lead">
                                      {importingIndex === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                              </Button>
                            )}
                          </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                </ScrollArea>
              </CardContent>

                {/* Bottom Summary Bar */}
                <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/40 bg-muted/20">
                  <p className="text-[10px] text-muted-foreground">
                    {searchResults.filter(r => r.imported).length} imported · {searchResults.filter(r => !r.imported).length} available
                  </p>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                      const csv = searchResults.map(r => `"${r.title}","${r.url}","${r.description || ''}"`).join('\n');
                      downloadAsFile('Title,URL,Description\n' + csv, `search-results-${new Date().toISOString().slice(0,10)}.csv`);
                    }}>
                      <Download className="h-2.5 w-2.5 mr-1" /> Export CSV
                    </Button>
              </div>
              </div>
            </Card>
          )}
        </TabsContent>

          {/* ── CSV Enrichment Tab ── */}
          <TabsContent value="csv-enrichment" className="mt-0">
            <Card className="border-border/60">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">CSV Enrichment</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Upload a CSV of companies and enrich with contact info, emails, LinkedIn profiles, and AI insights.
                  </p>
                </div>
                <Button onClick={() => window.location.href = '/dashboard/csv-enrichment'} size="sm" className="gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Open CSV Enrichment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </DashboardLayout>
  );
}
