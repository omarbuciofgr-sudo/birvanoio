import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { X, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerFlagBadges } from "@/components/rentcast/OwnerFlagBadges";
import type { OwnerFlag } from "@/lib/ownerFlags";

export type OwnerMapItem = {
  id: string;
  address: string;
  kind: "sale" | "rental";
  price: number | null;
  flags: OwnerFlag[];
  /** Coordinates already known (from the data provider or a saved lead). */
  lat?: number | null;
  lng?: number | null;
  leadId?: string;
  extra?: string;
  onOpen: () => void;
};

type Pos = { lat: number | null; lng: number | null };
const keyOf = (a: string) => a.trim().toLowerCase().replace(/\s+/g, " ");
const money = (n: number | null) => (n == null ? "Price not listed" : `$${Math.round(n).toLocaleString("en-US")}`);

let tokenPromise: Promise<string | null> | null = null;
const getToken = () =>
  (tokenPromise ??= supabase.functions
    .invoke("owner-map", { body: { mode: "token" } })
    .then(({ data }) => (data?.token as string) ?? null)
    .catch(() => null));

const cssColor = (name: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v.split(" ").join(", ")})` : "#1d4ed8";
};

function usePositions(items: OwnerMapItem[]) {
  const [positions, setPositions] = useState<Map<string, Pos>>(new Map());
  const [loading, setLoading] = useState(false);
  const sig = useMemo(() => items.map((i) => `${i.address}|${i.lat ?? ""}`).join(";"), [items]);

  useEffect(() => {
    let cancelled = false;
    const known = new Map<string, Pos>();
    const ask = items.filter((i) => {
      if (i.lat != null && i.lng != null) known.set(keyOf(i.address), { lat: i.lat, lng: i.lng });
      return !!i.address;
    });
    setPositions(new Map(known));
    const needsServer = ask.filter((i) => i.lat == null || i.leadId == null || true);
    if (!needsServer.length) return;
    setLoading(true);
    (async () => {
      for (let round = 0; round < 6 && !cancelled; round++) {
        const { data, error } = await supabase.functions.invoke("owner-map", {
          body: {
            mode: "locate",
            items: needsServer.slice(0, 500).map((i) => ({
              address: i.address, lat: i.lat ?? null, lng: i.lng ?? null, ...(i.leadId ? { lead_id: i.leadId } : {}),
            })),
          },
        });
        if (cancelled || error || !data) break;
        setPositions((prev) => {
          const m = new Map(prev);
          for (const [k, v] of Object.entries(data.positions as Record<string, Pos>)) m.set(k, v);
          return m;
        });
        if (!data.pending) break;
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return { positions, loading };
}

export function OwnerMap({ items, className = "" }: { items: OwnerMapItem[]; className?: string }) {
  const { user } = useAuth();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const savedView = useRef<{ center: [number, number]; zoom: number } | null | undefined>(undefined);
  const fitted = useRef(false);
  const { positions, loading } = usePositions(items);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const geojson = useMemo(() => {
    const features = items.flatMap((i) => {
      const p = positions.get(keyOf(i.address));
      if (p?.lat == null || p?.lng == null) return [];
      const dot = i.flags.some((f) => f.type === "price_drop" || f.type === "listed_30");
      return [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] }, properties: { id: i.id, kind: i.kind, dot } }];
    });
    return { type: "FeatureCollection" as const, features };
  }, [items, positions]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, profile] = await Promise.all([
        getToken(),
        user ? supabase.from("profiles").select("map_view").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled || !container.current) return;
      if (!token) { setTokenMissing(true); return; }
      const v = (profile.data as { map_view?: { center?: [number, number]; zoom?: number } } | null)?.map_view;
      savedView.current = v?.center && typeof v.zoom === "number" ? { center: v.center, zoom: v.zoom } : null;
      mapboxgl.accessToken = token;
      const dark = document.documentElement.classList.contains("dark");
      const m = new mapboxgl.Map({
        container: container.current,
        style: dark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
        center: savedView.current?.center ?? [-98.5, 39.5],
        zoom: savedView.current?.zoom ?? 3.5,
      });
      m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.current = m;
      if (savedView.current) fitted.current = true;

      m.on("load", () => {
        const selling = cssColor("--map-selling");
        const renting = cssColor("--map-renting");
        const accent = cssColor("--map-flag");
        const bg = cssColor("--background");
        m.addSource("owners", { type: "geojson", data: { type: "FeatureCollection", features: [] }, cluster: true, clusterMaxZoom: 13, clusterRadius: 45 });
        m.addLayer({ id: "clusters", type: "circle", source: "owners", filter: ["has", "point_count"],
          paint: { "circle-color": cssColor("--foreground"), "circle-opacity": 0.85, "circle-radius": ["step", ["get", "point_count"], 16, 20, 21, 100, 27], "circle-stroke-width": 2, "circle-stroke-color": bg } });
        m.addLayer({ id: "cluster-count", type: "symbol", source: "owners", filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"] },
          paint: { "text-color": bg } });
        m.addLayer({ id: "pins", type: "circle", source: "owners", filter: ["!", ["has", "point_count"]],
          paint: { "circle-color": ["match", ["get", "kind"], "sale", selling, renting], "circle-radius": 8, "circle-stroke-width": 2, "circle-stroke-color": bg } });
        m.addLayer({ id: "pin-dots", type: "circle", source: "owners", filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "dot"], true]],
          paint: { "circle-color": accent, "circle-radius": 3.5, "circle-translate": [7, -7], "circle-stroke-width": 1.5, "circle-stroke-color": bg } });

        m.on("click", "clusters", (e) => {
          const f = m.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
          const src = m.getSource("owners") as mapboxgl.GeoJSONSource;
          src.getClusterExpansionZoom(f.properties?.cluster_id, (err, zoom) => {
            if (err || zoom == null) return;
            m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
          });
        });
        m.on("click", "pins", (e) => setSelected((e.features?.[0]?.properties?.id as string) ?? null));
        for (const l of ["clusters", "pins"]) {
          m.on("mouseenter", l, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", l, () => (m.getCanvas().style.cursor = ""));
        }
        setReady(true);
      });

      let t: ReturnType<typeof setTimeout>;
      m.on("moveend", () => {
        if (!user) return;
        clearTimeout(t);
        t = setTimeout(() => {
          const c = m.getCenter();
          supabase.from("profiles").update({ map_view: { center: [c.lng, c.lat], zoom: m.getZoom() } }).eq("user_id", user.id).then(() => {});
        }, 800);
      });
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push data; fit to pins the first time if no saved position.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("owners") as mapboxgl.GeoJSONSource).setData(geojson);
    if (!fitted.current && geojson.features.length) {
      const b = new mapboxgl.LngLatBounds();
      geojson.features.forEach((f) => b.extend(f.geometry.coordinates as [number, number]));
      m.fitBounds(b, { padding: 60, maxZoom: 13, duration: 0 });
      fitted.current = true;
    }
  }, [geojson, ready]);

  useEffect(() => { if (selected && !byId.has(selected)) setSelected(null); }, [byId, selected]);

  const sel = selected ? byId.get(selected) : null;
  const unplaced = items.length - geojson.features.length;

  if (tokenMissing) {
    return (
      <div className={`flex h-[60vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground ${className}`}>
        <MapPin className="h-6 w-6" />
        The map isn't set up yet. Add the Mapbox token to turn it on.
      </div>
    );
  }

  return (
    <div className={`relative h-[60vh] min-h-[360px] overflow-hidden rounded-lg border border-border ${className}`}>
      <div ref={container} className="absolute inset-0" />
      {!ready && <Skeleton className="absolute inset-0" />}
      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="gap-1.5 bg-background/90"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--map-selling))]" />Selling</Badge>
        <Badge variant="secondary" className="gap-1.5 bg-background/90"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--map-renting))]" />Renting</Badge>
        <Badge variant="secondary" className="gap-1.5 bg-background/90"><span className="h-2 w-2 rounded-full bg-[hsl(var(--map-flag))]" />Price drop or 30+ days</Badge>
        {(loading || unplaced > 0) && (
          <Badge variant="outline" className="bg-background/90">{loading ? "Placing owners on the map…" : `${unplaced} without a map location`}</Badge>
        )}
      </div>
      {sel && (
        <div className="absolute inset-x-2 bottom-2 z-10 rounded-lg border border-border bg-card p-4 shadow-lg sm:inset-x-auto sm:left-2 sm:w-80">
          <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <p className="pr-8 text-sm font-semibold leading-snug">{sel.address}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{sel.kind === "sale" ? "Selling" : "Renting"}</Badge>
            {sel.extra && <Badge variant="outline">{sel.extra}</Badge>}
          </div>
          <p className="mt-2 text-lg font-semibold">{money(sel.price)}{sel.kind === "rental" && sel.price != null ? "/mo" : ""}</p>
          <OwnerFlagBadges flags={sel.flags} className="mt-2" />
          <Button className="mt-3 w-full min-h-11 sm:min-h-9" size="sm" onClick={sel.onOpen}>Open</Button>
        </div>
      )}
    </div>
  );
}

export default OwnerMap;
