import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/** Injected at build time from `.env` or your host’s env (Lovable, Vercel, etc.). Must use the `VITE_` prefix. */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!SUPABASE_URL?.trim() || !SUPABASE_PUBLISHABLE_KEY?.trim()) {
  const hint =
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (Project Settings → API: Project URL + anon public key), then rebuild/redeploy. ' +
    'Lovable: Project → Environment variables. Local: copy .env.example to .env';
  console.error('[Supabase]', hint, {
    hasUrl: Boolean(SUPABASE_URL?.trim()),
    hasKey: Boolean(SUPABASE_PUBLISHABLE_KEY?.trim()),
  });
  throw new Error(`Supabase is not configured for this build. ${hint}`);
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