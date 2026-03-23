import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from './constants';

/** Env (`VITE_*` / vite.config `define`) overrides; otherwise `constants.ts` defaults (brivano.io project). */
const SUPABASE_URL = resolveSupabaseUrl();
const SUPABASE_PUBLISHABLE_KEY = resolveSupabaseAnonKey();

function projectRefFromSupabaseUrl(url: string): string | null {
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m ? m[1].toLowerCase() : null;
}

/** `ref` claim inside the anon JWT must match the project URL subdomain, or you get 401 / auth errors. */
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