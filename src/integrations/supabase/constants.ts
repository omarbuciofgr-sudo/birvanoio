/**
 * Production defaults when `VITE_*` is unset at build time (e.g. Lovable Cloud Secrets not wired to Vite).
 * The anon key is the public client key (RLS still applies). Override with env for other projects or key rotation.
 */
export const DEFAULT_SUPABASE_URL = 'https://xgcvdduwrvgquurhngzq.supabase.co';

export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnY3ZkZHV3cnZncXV1cmhuZ3pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MTE2MzEsImV4cCI6MjA4Mzk4NzYzMX0.d_1TKDQ0sC5tYjn3EZEQxkDJRkoxCHDd_K8DG6Ty9Hs';

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
