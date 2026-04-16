/**
 * Production defaults when `VITE_*` is unset at build time (e.g. Lovable Cloud Secrets not wired to Vite).
 * The anon key is the public client key (RLS still applies). Override with env for other projects or key rotation.
 */
export const DEFAULT_SUPABASE_URL = 'https://eotfijnsfwroukhjwsbe.supabase.co';

export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdGZpam5zZndyb3VraGp3c2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTgyOTcsImV4cCI6MjA4MzM3NDI5N30.T1nh8QT7Izk697n9dr0LMM0Dg8zlLxhmP6Y_oJ53dhw';

export function resolveSupabaseUrl(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  return (raw || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
}

export function resolveSupabaseAnonKey(): string {
  const raw =
    ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined))?.trim();
  return raw || DEFAULT_SUPABASE_ANON_KEY;
}
