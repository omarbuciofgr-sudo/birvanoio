import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Lovable / CI often set SUPABASE_URL + SUPABASE_ANON_KEY (no VITE_ prefix). Vite only exposes VITE_* to the client by default, so we map them at build time. Never expose SUPABASE_SERVICE_KEY here. */
function resolveSupabaseForClient(mode: string) {
  const file = loadEnv(mode, process.cwd(), "");
  const stripQuotes = (s: string) => s.trim().replace(/^["']|["']$/g, "");

  const url = stripQuotes(
    process.env.VITE_SUPABASE_URL ||
      file.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      file.SUPABASE_URL ||
      ""
  ).replace(/\/+$/, "");

  const key = stripQuotes(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      file.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      file.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      file.SUPABASE_ANON_KEY ||
      ""
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
