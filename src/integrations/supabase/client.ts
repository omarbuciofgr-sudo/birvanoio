import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/** Injected at build time. `vite.config` maps `SUPABASE_URL` / `SUPABASE_ANON_KEY` into these `VITE_*` values so Lovable can use standard names. Service role must never be bundled. */
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

const SUPABASE_URL = rawUrl?.trim() ?? '';
const SUPABASE_PUBLISHABLE_KEY = rawKey?.trim() ?? '';

function projectRefFromSupabaseUrl(url: string): string | null {
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m ? m[1].toLowerCase() : null;
}

/** `ref` claim inside the anon JWT must match the subdomain of VITE_SUPABASE_URL, or you get 401 / auth errors. */
function projectRefFromAnonKey(anonKey: string): string | null {
  try {
    const parts = anonKey.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { ref?: string };
    return typeof payload.ref === 'string' ? payload.ref.toLowerCase() : null;
  } catch {
    return null;
  }
}

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const hint =
    'These values must exist when `npm run build` runs (embedded in JS). Lovable Cloud → Secrets often does NOT inject into the Vite build—add VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY on your real host (GitHub Actions, Vercel, Netlify, Cloudflare) if brivano.io deploys from Git. ' +
    'Or use Lovable Publish env if offered. sb_url/sb_anon only work if the build sees them. No quotes; trim URL. Never use SUPABASE_SERVICE_KEY in the frontend.';
  console.error('[Supabase]', hint, {
    hasUrl: Boolean(SUPABASE_URL),
    hasKey: Boolean(SUPABASE_PUBLISHABLE_KEY),
    mode: import.meta.env.MODE,
  });
  throw new Error(`Supabase is not configured for this build. ${hint}`);
}

const urlRef = projectRefFromSupabaseUrl(SUPABASE_URL);
const keyRef = projectRefFromAnonKey(SUPABASE_PUBLISHABLE_KEY);
if (urlRef && keyRef && urlRef !== keyRef) {
  console.error('[Supabase] URL and anon key are from different projects:', {
    urlRef,
    keyRef,
    fix: `Use Project URL + anon key from the SAME Supabase project (e.g. https://${keyRef}.supabase.co with this key).`,
  });
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});