import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Never expose SUPABASE_SERVICE_KEY here. */
function pickEnv(file: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key] ?? file[key];
    if (v !== undefined && String(v).trim() !== "") return String(v);
  }
  return "";
}

/** Match env keys case-insensitively (e.g. SB_URL vs sb_url). */
function pickEnvCi(file: Record<string, string>, lowerNames: string[]): string {
  const want = new Set(lowerNames.map((n) => n.toLowerCase()));
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || String(v).trim() === "") continue;
    if (want.has(k.toLowerCase())) return String(v);
  }
  for (const [k, v] of Object.entries(file)) {
    if (!v || String(v).trim() === "") continue;
    if (want.has(k.toLowerCase())) return String(v);
  }
  return "";
}

function resolveSupabaseForClient(mode: string) {
  const file = loadEnv(mode, process.cwd(), "");
  const stripQuotes = (s: string) => s.trim().replace(/^["']|["']$/g, "");

  const url = stripQuotes(
    pickEnv(file, [
      "VITE_SUPABASE_URL",
      "VITE_SB_URL",
      "SUPABASE_URL",
      "vite_supabase_url",
      "supabase_url",
      "sb_url",
    ]) ||
      pickEnvCi(file, [
        "vite_supabase_url",
        "supabase_url",
        "sb_url",
        "vite_sb_url",
      ])
  ).replace(/\/+$/, "");

  const key = stripQuotes(
    pickEnv(file, [
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_SB_ANON",
      "SUPABASE_ANON_KEY",
      "vite_supabase_publishable_key",
      "vite_supabase_anon_key",
      "supabase_anon_key",
      "sb_anon",
    ]) ||
      pickEnvCi(file, [
        "vite_supabase_publishable_key",
        "vite_supabase_anon_key",
        "supabase_anon_key",
        "sb_anon",
        "vite_sb_anon",
      ])
  );

  return { url, key };
}

function warnIfSupabaseMissingAtBuild(): Plugin {
  return {
    name: "warn-supabase-env",
    buildStart() {
      if (process.env.npm_lifecycle_event !== "build" && !process.argv.includes("build")) return;
      const { url, key } = resolveSupabaseForClient("production");
      if (url && key) return;
      console.warn(
        "\n[vite] Supabase URL/key were empty when reading process.env during this build. " +
          "Lovable Cloud → Secrets is often wired to Edge Functions only, not the Vite bundle. " +
          "If brivano.io is built from GitHub, add repo secrets VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY " +
          "(see https://docs.lovable.dev/tips-tricks/external-deployment-hosting ). " +
          "Then redeploy / Publish again.\n"
      );
    },
  };
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
    plugins: [
      react(),
      warnIfSupabaseMissingAtBuild(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    ...(Object.keys(define).length > 0 ? { define } : {}),
  };
});
