import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Item = z.object({
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  lead_id: z.string().uuid().optional(),
});
const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("token") }),
  z.object({ mode: z.literal("locate"), items: z.array(Item).max(500) }),
]);

const keyOf = (a: string) => a.trim().toLowerCase().replace(/\s+/g, " ");
const MAX_LOOKUPS_PER_CALL = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    if (parsed.data.mode === "token") {
      const token = Deno.env.get("MAPBOX_TOKEN");
      if (!token) return json({ error: "Map is not set up yet" }, 503);
      return json({ token });
    }

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const items = parsed.data.items;
    const keys = [...new Set(items.map((i) => keyOf(i.address)))];
    const out = new Map<string, { lat: number | null; lng: number | null }>();

    // 1. Coordinates the data provider already returned: save them.
    const provided = new Map<string, { latitude: number; longitude: number }>();
    for (const i of items) if (i.lat != null && i.lng != null) provided.set(keyOf(i.address), { latitude: i.lat, longitude: i.lng });

    // 2. Already known addresses.
    for (let i = 0; i < keys.length; i += 200) {
      const { data } = await admin.from("geocode_cache").select("address_key, latitude, longitude").in("address_key", keys.slice(i, i + 200));
      for (const r of data ?? []) out.set(r.address_key, { lat: r.latitude, lng: r.longitude });
    }
    const newProvided = [...provided].filter(([k]) => !out.get(k)?.lat);
    if (newProvided.length) {
      await admin.from("geocode_cache").upsert(newProvided.map(([k, v]) => ({ address_key: k, ...v, source: "rentcast" })));
      for (const [k, v] of newProvided) out.set(k, { lat: v.latitude, lng: v.longitude });
    }

    // 3. Look up the rest with Mapbox permanent geocoding, once per address ever.
    const missing = keys.filter((k) => !out.has(k)).slice(0, MAX_LOOKUPS_PER_CALL);
    const sk = Deno.env.get("MAPBOX_SECRET_TOKEN");
    let pending = keys.filter((k) => !out.has(k)).length;
    if (missing.length && sk) {
      const original = new Map(items.map((i) => [keyOf(i.address), i.address]));
      const rows: { address_key: string; latitude: number | null; longitude: number | null; source: string }[] = [];
      for (let i = 0; i < missing.length; i += 6) {
        await Promise.all(missing.slice(i, i + 6).map(async (k) => {
          const q = encodeURIComponent(original.get(k) ?? k);
          const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${q}&country=us&limit=1&types=address&permanent=true&access_token=${sk}`);
          if (!res.ok) { console.error(`Mapbox geocode failed [${res.status}]: ${await res.text()}`); return; }
          const body = await res.json();
          const c = body?.features?.[0]?.geometry?.coordinates;
          const hit = Array.isArray(c) ? { lat: c[1] as number, lng: c[0] as number } : { lat: null, lng: null };
          rows.push({ address_key: k, latitude: hit.lat, longitude: hit.lng, source: hit.lat == null ? "mapbox_not_found" : "mapbox" });
          out.set(k, hit);
        }));
      }
      if (rows.length) await admin.from("geocode_cache").upsert(rows);
      pending = keys.filter((k) => !out.has(k)).length;
    }

    // 4. Store positions on the user's own leads.
    const leadUpdates = items.filter((i) => i.lead_id && out.get(keyOf(i.address))?.lat != null);
    for (const i of leadUpdates) {
      const p = out.get(keyOf(i.address))!;
      await admin.from("leads").update({ latitude: p.lat, longitude: p.lng }).eq("id", i.lead_id!).eq("client_id", user.id).is("latitude", null);
    }

    return json({ positions: Object.fromEntries(out), pending });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
