import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MapPin, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const SEARCH_TYPES = [
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'store', label: 'Retail Stores' },
  { value: 'doctor', label: 'Healthcare' },
  { value: 'lawyer', label: 'Legal Services' },
  { value: 'gym', label: 'Fitness & Gyms' },
  { value: 'salon', label: 'Salons & Spas' },
  { value: 'plumber', label: 'Plumbing' },
  { value: 'electrician', label: 'Electricians' },
  { value: 'dentist', label: 'Dentists' },
  { value: 'real_estate_agent', label: 'Real Estate' },
  { value: 'car_dealer', label: 'Auto Dealers' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'cafe', label: 'Cafes' },
  { value: 'bar', label: 'Bars & Nightlife' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'insurance_agency', label: 'Insurance' },
  { value: 'contractor', label: 'Contractors' },
  { value: 'veterinary_care', label: 'Veterinary' },
];

/* ── Map sub-components ──────────────────────────────────────── */

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

function DraggableCenter({ position, onPositionChange }: { position: [number, number]; onPositionChange: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onPositionChange([e.latlng.lat, e.latlng.lng]);
    },
  });
  return <Marker position={position} />;
}

/* ── Helper ──────────────────────────────────────────────────── */

function milesToMeters(miles: number) {
  return miles * 1609.34;
}

function metersToFeet(meters: number) {
  return Math.round(meters * 3.28084);
}

/* ── Main Component ──────────────────────────────────────────── */

export type LocalBusinessPlannerPrefill = {
  locationQuery: string;
  radiusMiles: number;
  searchType: string;
  keyword: string;
};

/** Shape passed to `validateScraper('local', …)` — synced so parent can derive `missingFields` without duplicating rules. */
export type LocalBusinessLensSync = {
  locationQuery: string;
  lat: number;
  lng: number;
  radiusMiles: number;
  searchType: string;
  /** Optional for API only — never required by validateScraper local rules */
  keyword: string;
};

/** Keep in sync with initial state below — parent uses this for `validateScraper` before first child sync. */
export const DEFAULT_LOCAL_LENS_SYNC: LocalBusinessLensSync = {
  locationQuery: '',
  lat: 40.7413,
  lng: -73.9897,
  radiusMiles: 5,
  searchType: 'restaurant',
  keyword: '',
};

interface LocalBusinessSearchProps {
  onSearch: (params: {
    lat: number;
    lng: number;
    radiusMiles: number;
    searchType: string;
    keyword: string;
    /** Location text box (for validation — geo group with lat/lng) */
    locationQuery: string;
  }) => void;
  isSearching: boolean;
  /** camelCase keys from `validateScraper('local', …).missingFields` */
  invalidFields?: string[];
  /** Apply planner answers: geocode location and optionally run search once */
  plannerPrefill?: LocalBusinessPlannerPrefill | null;
  onPlannerPrefillConsumed?: () => void;
  /** Fires on mount and whenever synced fields change — parent runs `validateScraper('local', shape)`. */
  onValidationShapeChange?: (shape: LocalBusinessLensSync) => void;
}

export function LocalBusinessSearch({
  onSearch,
  isSearching,
  invalidFields,
  plannerPrefill,
  onPlannerPrefillConsumed,
  onValidationShapeChange,
}: LocalBusinessSearchProps) {
  const [center, setCenter] = useState<[number, number]>([DEFAULT_LOCAL_LENS_SYNC.lat, DEFAULT_LOCAL_LENS_SYNC.lng]);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_LOCAL_LENS_SYNC.radiusMiles);
  const [searchType, setSearchType] = useState(DEFAULT_LOCAL_LENS_SYNC.searchType);
  const [keyword, setKeyword] = useState(DEFAULT_LOCAL_LENS_SYNC.keyword);
  const [locationQuery, setLocationQuery] = useState(DEFAULT_LOCAL_LENS_SYNC.locationQuery);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [zoom, setZoom] = useState(12);

  const radiusMeters = milesToMeters(radiusMiles);
  const radiusFeet = metersToFeet(radiusMeters);

  const inv = invalidFields ?? [];
  const badLoc = inv.some((x) => ['locationQuery', 'lat', 'lng'].includes(x));
  const badRadius = inv.includes('radiusMiles');
  const badType = inv.includes('searchType');

  useEffect(() => {
    onValidationShapeChange?.({
      locationQuery,
      lat: center[0],
      lng: center[1],
      radiusMiles,
      searchType,
      keyword,
    });
  }, [center, locationQuery, radiusMiles, searchType, keyword, onValidationShapeChange]);

  // Geocode location search
  const handleLocationSearch = useCallback(async () => {
    if (!locationQuery.trim()) return;
    setIsGeocoding(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=1`
      );
      const data = await resp.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        setCenter([parseFloat(lat), parseFloat(lon)]);
        setZoom(13);
      }
    } catch {
      // silently fail
    } finally {
      setIsGeocoding(false);
    }
  }, [locationQuery]);

  const plannerPrefillKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!plannerPrefill) {
      plannerPrefillKeyRef.current = null;
      return;
    }
    const key = JSON.stringify(plannerPrefill);
    if (plannerPrefillKeyRef.current === key) return;
    plannerPrefillKeyRef.current = key;

    const r = Math.min(50, Math.max(0.1, plannerPrefill.radiusMiles));
    setRadiusMiles(r);
    setSearchType(plannerPrefill.searchType);
    setKeyword(plannerPrefill.keyword ?? '');
    const q = plannerPrefill.locationQuery?.trim() ?? '';
    setLocationQuery(q);

    let cancelled = false;
    (async () => {
      if (!q) {
        onPlannerPrefillConsumed?.();
        return;
      }
      setIsGeocoding(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
        );
        const data = await resp.json();
        if (cancelled || !data.length) return;
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setCenter([lat, lng]);
        setZoom(13);
        onSearch({
          lat,
          lng,
          radiusMiles: r,
          searchType: plannerPrefill.searchType,
          keyword: plannerPrefill.keyword ?? '',
          locationQuery: q,
        });
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setIsGeocoding(false);
        onPlannerPrefillConsumed?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plannerPrefill, onSearch, onPlannerPrefillConsumed]);

  // Dynamically adjust zoom based on radius
  useEffect(() => {
    if (radiusMiles <= 1) setZoom(15);
    else if (radiusMiles <= 5) setZoom(12);
    else if (radiusMiles <= 25) setZoom(10);
    else if (radiusMiles <= 100) setZoom(8);
    else setZoom(7);
  }, [radiusMiles]);

  const handleContinue = () => {
    onSearch({
      lat: center[0],
      lng: center[1],
      radiusMiles,
      searchType,
      keyword,
      locationQuery,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold tracking-tight">Find local businesses using Google Maps</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pull local businesses from a specific location on Google Maps
        </p>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="space-y-4 pb-4">
          {/* Description */}
          <p className="text-xs text-muted-foreground">
            Search for a location or drag the map, and then adjust the search radius.
          </p>

          {/* Location search */}
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for a location..."
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                data-invalid-field="locationQuery"
                className={`pl-10 h-9 text-sm ${badLoc ? 'border-2 border-destructive ring-2 ring-destructive/35' : ''}`}
              />
              {isGeocoding && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {badLoc && (
              <p className="text-[11px] text-destructive">Enter a location or use the map to set coordinates.</p>
            )}
          </div>

          {/* Map */}
          <div
            data-invalid-field={badLoc ? 'lat' : undefined}
            className={`rounded-lg overflow-hidden h-[300px] relative ${
              badLoc ? 'border-2 border-destructive ring-2 ring-destructive/35' : 'border border-border/60'
            }`}
          >
            <MapContainer
              center={center}
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater center={center} zoom={zoom} />
              <DraggableCenter position={center} onPositionChange={setCenter} />
              <Circle
                center={center}
                radius={radiusMeters}
                pathOptions={{
                  color: 'hsl(var(--primary))',
                  fillColor: 'hsl(var(--primary))',
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              />
            </MapContainer>
          </div>

          {/* Proximity Radius */}
          <div
            data-invalid-field={badRadius ? 'radiusMiles' : undefined}
            className={`space-y-2 rounded-md ${badRadius ? 'border-2 border-destructive ring-2 ring-destructive/35 p-2 -m-0.5' : ''}`}
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Proximity Radius</Label>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{radiusFeet.toLocaleString()} feet</span>
                <span>{radiusMiles} miles</span>
              </div>
            </div>
            <Slider
              value={[radiusMiles]}
              onValueChange={(v) => setRadiusMiles(v[0])}
              min={0.1}
              max={50}
              step={0.1}
              className="w-full"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>48 feet</span>
              <span>1179 miles</span>
            </div>
            {badRadius && (
              <p className="text-[11px] text-destructive">Set a radius greater than zero.</p>
            )}
          </div>

          {/* Search Type */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              Search Type <span className="text-destructive">*</span>
            </Label>
            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger
                data-invalid-field="searchType"
                className={`h-9 text-sm ${badType ? 'border-2 border-destructive ring-2 ring-destructive/35' : ''}`}
              >
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent className="z-[9999] bg-popover border border-border shadow-xl" position="popper" sideOffset={4}>
                {SEARCH_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-sm">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {badType && <p className="text-[11px] text-destructive">Select a search type.</p>}
          </div>

          {/* Additional keyword */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Keyword (optional)</Label>
            <Input
              placeholder="e.g. pizza, roofing, HVAC"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex-shrink-0 h-12 border-t border-border/60 px-4 flex items-center justify-end bg-muted/30">
        <Button
          onClick={handleContinue}
          disabled={isSearching || (invalidFields?.length ?? 0) > 0}
          size="sm"
          className="h-7 px-5 text-xs font-semibold"
        >
          {isSearching ? 'Searching…' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
