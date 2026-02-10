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

interface LocalBusinessSearchProps {
  onSearch: (params: {
    lat: number;
    lng: number;
    radiusMiles: number;
    searchType: string;
    keyword: string;
  }) => void;
  isSearching: boolean;
}

export function LocalBusinessSearch({ onSearch, isSearching }: LocalBusinessSearchProps) {
  const [center, setCenter] = useState<[number, number]>([40.7413, -73.9897]); // NYC Flatiron
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [searchType, setSearchType] = useState('restaurant');
  const [keyword, setKeyword] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [zoom, setZoom] = useState(12);

  const radiusMeters = milesToMeters(radiusMiles);
  const radiusFeet = metersToFeet(radiusMeters);

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a location..."
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
              className="pl-10 h-9 text-sm"
            />
            {isGeocoding && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Map */}
          <div className="rounded-lg overflow-hidden border border-border/60 h-[300px] relative">
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
          <div className="space-y-2">
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
          </div>

          {/* Search Type */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              Search Type <span className="text-destructive">*</span>
            </Label>
            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="h-9 text-sm">
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
          disabled={isSearching}
          size="sm"
          className="h-7 px-5 text-xs font-semibold"
        >
          {isSearching ? 'Searching…' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
