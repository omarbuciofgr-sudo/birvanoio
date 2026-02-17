import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, ExternalLink, MapPin } from 'lucide-react';
import { getPlatformLogoFromUrl } from '@/lib/platformLogos';
import { scraperBackendApi } from '@/lib/api/scraperBackend';

// Fix default marker icons for leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const successIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const defaultIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const searchLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** True if listing address matches the searched location (e.g. "washington" matches "123 Main St, Washington, DC"). */
function addressMatchesSearch(address: string | undefined, searchLocation: string | undefined): boolean {
  if (!searchLocation?.trim() || !address?.trim()) return true;
  const q = searchLocation.toLowerCase().trim();
  const addr = address.toLowerCase();
  if (addr.includes(q)) return true;
  const cityAliases: Record<string, string[]> = {
    washington: ['washington', 'dc', 'district of columbia'],
    chicago: ['chicago'],
    minneapolis: ['minneapolis'],
    'new york': ['new york', 'nyc', 'manhattan', 'brooklyn'],
    'san francisco': ['san francisco', 'sf'],
    'los angeles': ['los angeles', ', la '],
  };
  const terms = cityAliases[q] || [q];
  return terms.some(term => addr.includes(term));
}

interface ListingsMapProps {
  listings: any[];
  onSelectListing?: (index: number) => void;
  searchLocation?: string;
}

// Geocode via backend proxy. Returns 'unavailable' on 404/502 so the component stops requesting.
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null | 'unavailable'> {
  try {
    const base = scraperBackendApi.getBaseUrl();
    const res = await fetch(`${base}/api/geocode?q=${encodeURIComponent(address)}`);
    if (res.status === 404 || res.status === 502) return 'unavailable';
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function FitBounds({ positions, searchCenter }: { positions: [number, number][]; searchCenter?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const allPoints = searchCenter ? [...positions, searchCenter] : positions;
      const bounds = L.latLngBounds(allPoints.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else if (searchCenter) {
      map.setView(L.latLng(searchCenter[0], searchCenter[1]), 12);
    }
  }, [positions, searchCenter, map]);
  return null;
}

function PlatformLogo({ sourceUrl }: { sourceUrl?: string }) {
  if (!sourceUrl) return null;
  const logoUrl = getPlatformLogoFromUrl(sourceUrl);
  if (!logoUrl) return null;
  return (
    <img
      src={logoUrl}
      alt=""
      className="h-4 w-4 rounded-sm"
      style={{ imageRendering: 'auto' }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

export default function ListingsMap({ listings, onSelectListing, searchLocation }: ListingsMapProps) {
  const [geocoded, setGeocoded] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [geocoding, setGeocoding] = useState(false);
  const [searchCenter, setSearchCenter] = useState<[number, number] | undefined>();
  const geocodedRef = useRef(new Set<string>());

  const [geocodeUnavailable, setGeocodeUnavailable] = useState(false);

  // When user searches e.g. "washington", only show listings that match that location on the map
  const filteredListings = useMemo(() => {
    if (!searchLocation?.trim()) return listings;
    return listings.filter(l => addressMatchesSearch(l.address, searchLocation));
  }, [listings, searchLocation]);

  // Geocode the search location to center the map
  useEffect(() => {
    if (!searchLocation || geocodeUnavailable) return;
    (async () => {
      const result = await geocodeAddress(searchLocation);
      if (result === 'unavailable') setGeocodeUnavailable(true);
      else if (result) setSearchCenter([result.lat, result.lng]);
    })();
  }, [searchLocation, geocodeUnavailable]);

  useEffect(() => {
    if (filteredListings.length === 0 || geocodeUnavailable) return;

    const toGeocode = filteredListings
      .map(l => l.address)
      .filter((address): address is string => !!address?.trim() && !geocodedRef.current.has(address));
    const unique = Array.from(new Set(toGeocode));
    if (unique.length === 0) return;

    setGeocoding(true);
    let cancelled = false;

    (async () => {
      for (const address of unique) {
        if (cancelled) break;
        geocodedRef.current.add(address);
        const result = await geocodeAddress(address);
        if (result === 'unavailable') {
          setGeocodeUnavailable(true);
          break;
        }
        if (result && !cancelled) {
          setGeocoded(prev => new Map(prev).set(address, result));
        }
        await new Promise(r => setTimeout(r, 1100));
      }
      if (!cancelled) setGeocoding(false);
    })();

    return () => { cancelled = true; };
  }, [filteredListings, geocodeUnavailable]);

  const positions = useMemo(() => {
    return filteredListings
      .map((listing, index) => {
        const pos = listing.address ? geocoded.get(listing.address) : undefined;
        if (!pos) return null;
        return { index, position: [pos.lat, pos.lng] as [number, number], listing };
      })
      .filter((p): p is { index: number; position: [number, number]; listing: any } => p !== null);
  }, [filteredListings, geocoded]);

  if (listings.length === 0) return null;

  // Fallback centers for common search locations when geocoding hasn't run or failed
  const searchLocationFallback = (): [number, number] | undefined => {
    if (!searchLocation || typeof searchLocation !== 'string') return undefined;
    const q = searchLocation.toLowerCase().trim();
    if (q.includes('minneapolis')) return [44.9778, -93.265];
    if (q.includes('chicago')) return [41.8781, -87.6298];
    if (q.includes('dallas')) return [32.7767, -96.797];
    if (q.includes('houston')) return [29.7604, -95.3698];
    if (q.includes('phoenix')) return [33.4484, -112.074];
    if (q.includes('denver')) return [39.7392, -104.9903];
    if (q.includes('seattle')) return [47.6062, -122.3321];
    if (q.includes('atlanta')) return [33.749, -84.388];
    if (q.includes('miami')) return [25.7617, -80.1918];
    if (q.includes('new york') || q.includes('nyc')) return [40.7128, -74.006];
    if (q.includes('los angeles') || q === 'la' || q.includes('los angles')) return [34.0522, -118.2437];
    if (q.includes('washington')) return [38.9072, -77.0369];
    if (q.includes('san francisco') || q.includes('san fracisco')) return [37.7749, -122.4194];
    return undefined;
  };

  const defaultCenter: [number, number] = searchCenter
    ? searchCenter
    : positions.length > 0
      ? positions[0].position
      : searchLocationFallback() ?? [39.8283, -98.5795];

  return (
    <div className="relative rounded-lg overflow-hidden border border-border/60">
      {(geocoding || geocodeUnavailable) && (
        <div className="absolute top-3 right-3 z-[1000] bg-background/90 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
          {geocodeUnavailable ? (
            <span className="text-[10px] font-medium text-muted-foreground">
              Map pins need the scraper backend (port 8080) with <code className="text-[9px]">/api/geocode</code>. Restart the backend and refresh.
            </span>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-medium text-muted-foreground">
                Geocoding... {geocoded.size}/{filteredListings.filter(l => l.address).length}
              </span>
            </>
          )}
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '450px', width: '100%' }}
        className="z-0"
      >
        {/* CARTO tiles (avoid OpenStreetMap 503 errors); centers/pins work for Chicago, Washington, etc. via searchLocation + geocode */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <FitBounds positions={positions.map(p => p.position)} searchCenter={searchCenter} />
        {/* Highlight the searched location (e.g. "You searched: Washington") so only that area is emphasized */}
        {searchLocation?.trim() && (searchCenter || searchLocationFallback()) && (
          <Marker
            position={searchCenter || searchLocationFallback()!}
            icon={searchLocationIcon}
            zIndexOffset={1000}
          >
            <Popup>
              <span className="font-semibold text-sm">You searched: {searchLocation.trim()}</span>
            </Popup>
          </Marker>
        )}
        <MarkerClusterGroup chunkedLoading>
          {positions.map(({ index, position, listing }) => (
            <Marker
              key={index}
              position={position}
              icon={listing.skip_trace_status === 'success' ? successIcon : defaultIcon}
              eventHandlers={{
                click: () => onSelectListing?.(index),
              }}
            >
              <Popup maxWidth={300} className="listing-popup">
              <div className="space-y-1.5 text-xs">
                <p className="font-semibold text-sm leading-tight">{listing.address}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {listing.source_url && (
                    <span className="inline-flex items-center gap-1">
                      <PlatformLogo sourceUrl={listing.source_url} />
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {listing.source_platform || (() => { try { return new URL(listing.source_url).hostname.replace('www.', ''); } catch { return ''; } })()}
                      </span>
                    </span>
                  )}
                  {listing.price && <Badge variant="secondary" className="text-[10px] h-4">{listing.price}</Badge>}
                  {listing.property_type && <Badge variant="outline" className="text-[10px] h-4">{listing.property_type}</Badge>}
                  {listing.skip_trace_status === 'success' && (
                    <Badge className="bg-green-500/10 text-green-600 text-[10px] h-4 border-0">Traced</Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {[listing.bedrooms && `${listing.bedrooms} bed`, listing.bathrooms && `${listing.bathrooms} bath`, listing.square_feet && `${listing.square_feet.toLocaleString()} sqft`].filter(Boolean).join(' · ')}
                </p>
                {listing.owner_name && (
                  <p className="font-medium pt-1 border-t border-border/40">{listing.owner_name}</p>
                )}
                <div className="flex items-center gap-3">
                  {listing.owner_phone && (
                    <a href={`tel:${listing.owner_phone}`} className="text-primary hover:underline flex items-center gap-0.5">
                      <Phone className="h-2.5 w-2.5" /> {listing.owner_phone}
                    </a>
                  )}
                  {listing.owner_email && (
                    <a href={`mailto:${listing.owner_email}`} className="text-primary hover:underline flex items-center gap-0.5">
                      <Mail className="h-2.5 w-2.5" /> {listing.owner_email}
                    </a>
                  )}
                </div>
                {listing.source_url && (
                  <a href={listing.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex items-center gap-0.5 text-[10px]">
                    View listing <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border/40 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {geocoded.size} of {filteredListings.filter(l => l.address).length} locations mapped
        </span>
        <div className="flex items-center gap-3">
          {searchLocation?.trim() && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> You searched
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Listing
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" /> Skip Traced
          </span>
        </div>
      </div>
    </div>
  );
}
