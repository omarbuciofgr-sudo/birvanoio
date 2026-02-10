import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, ExternalLink, MapPin } from 'lucide-react';

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

interface ListingsMapProps {
  listings: any[];
  onSelectListing?: (index: number) => void;
}

// Simple geocoding using Nominatim (free, no API key needed)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'User-Agent': 'BrivanoApp/1.0' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

export default function ListingsMap({ listings, onSelectListing }: ListingsMapProps) {
  const [geocoded, setGeocoded] = useState<Map<number, { lat: number; lng: number }>>(new Map());
  const [geocoding, setGeocoding] = useState(false);
  const geocodedRef = useRef(new Set<number>());

  useEffect(() => {
    if (listings.length === 0) return;

    const toGeocode = listings
      .map((l, i) => ({ index: i, address: l.address }))
      .filter(item => item.address && !geocodedRef.current.has(item.index));

    if (toGeocode.length === 0) return;

    setGeocoding(true);
    let cancelled = false;

    (async () => {
      for (const item of toGeocode) {
        if (cancelled) break;
        geocodedRef.current.add(item.index);
        const result = await geocodeAddress(item.address);
        if (result && !cancelled) {
          setGeocoded(prev => new Map(prev).set(item.index, result));
        }
        // Rate limit: Nominatim asks for 1 req/sec
        await new Promise(r => setTimeout(r, 1100));
      }
      if (!cancelled) setGeocoding(false);
    })();

    return () => { cancelled = true; };
  }, [listings]);

  const positions = useMemo(() => {
    return Array.from(geocoded.entries()).map(([index, pos]) => ({
      index,
      position: [pos.lat, pos.lng] as [number, number],
      listing: listings[index],
    }));
  }, [geocoded, listings]);

  if (listings.length === 0) return null;

  const defaultCenter: [number, number] = positions.length > 0
    ? positions[0].position
    : [39.8283, -98.5795]; // Center of US

  return (
    <div className="relative rounded-lg overflow-hidden border border-border/60">
      {geocoding && (
        <div className="absolute top-3 right-3 z-[1000] bg-background/90 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-medium text-muted-foreground">
            Geocoding... {geocoded.size}/{listings.filter(l => l.address).length}
          </span>
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={10}
        style={{ height: '400px', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length > 0 && (
          <FitBounds positions={positions.map(p => p.position)} />
        )}
        {positions.map(({ index, position, listing }) => (
          <Marker
            key={index}
            position={position}
            icon={listing.skip_trace_status === 'success' ? successIcon : defaultIcon}
            eventHandlers={{
              click: () => onSelectListing?.(index),
            }}
          >
            <Popup maxWidth={280} className="listing-popup">
              <div className="space-y-1.5 text-xs">
                <p className="font-semibold text-sm leading-tight">{listing.address}</p>
                <div className="flex items-center gap-2 flex-wrap">
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
      </MapContainer>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border/40 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {geocoded.size} of {listings.filter(l => l.address).length} locations mapped
        </span>
        <div className="flex items-center gap-3">
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
