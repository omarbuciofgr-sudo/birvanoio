import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Lovable Secrets sometimes only allow lowercase names — include those variants. Never expose SUPABASE_SERVICE_KEY here. */
function pickEnv(file: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key] ?? file[key];
    if (v !== undefined && String(v).trim() !== "") return String(v);
  }
  return "";
}

function resolveSupabaseForClient(mode: string) {
  const file = loadEnv(mode, process.cwd(), "");
  const stripQuotes = (s: string) => s.trim().replace(/^["']|["']$/g, "");

  const url = stripQuotes(
    pickEnv(file, [
      "VITE_SUPABASE_URL",
      "SUPABASE_URL",
      "vite_supabase_url",
      "supabase_url",
    ])
  ).replace(/\/+$/, "");

  const key = stripQuotes(
    pickEnv(file, [
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
      "vite_supabase_publishable_key",
      "vite_supabase_anon_key",
      "supabase_anon_key",
    ])
  );

  return { url, key };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const { url: supabaseUrl, key: supabaseAnon } = resolveSupabaseForClient(mode);

  // Only map non-empty values. Always defining "" overwrites Vite/Lovable-injected `import.meta.env` and causes a blank production app.
  const define: Record<string, string> = {};
  if (supabaseUrl) {
    define["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(supabaseUrl);
  }
  if (supabaseAnon) {
    define["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(supabaseAnon);
  }

  return {
    server: {
      host: "::",
      port: 5173,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    ...(Object.keys(define).length > 0 ? { define } : {}),
  };
});
