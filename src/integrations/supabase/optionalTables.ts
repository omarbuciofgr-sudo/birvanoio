/**
 * Optional Supabase tables that may not exist yet (e.g. before migrations).
 * Once we get an error for a table, we skip further requests (persisted in sessionStorage for the tab).
 * When VITE_SKIP_OPTIONAL_TABLES is true, we never request these tables (avoids 404s).
 */

const STORAGE_KEY = "supabase_optional_tables_missing";

/** Tables that are optional and often missing; skip entirely when env flag is set */
const KNOWN_OPTIONAL_TABLES = [
  "notifications",
  "user_notifications",
  "team_activity_log",
  "dynamic_lists",
  "custom_reports",
  "signal_subscriptions",
  "ai_agents",
];

function loadMissing(): Set<string> {
  const skipOptional = typeof import.meta !== "undefined" && import.meta.env?.VITE_SKIP_OPTIONAL_TABLES === "true";
  if (skipOptional) {
    return new Set(KNOWN_OPTIONAL_TABLES);
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      return new Set(Array.isArray(arr) ? arr : []);
    }
  } catch {
    // ignore
  }
  return new Set<string>();
}

function saveMissing(set: Set<string>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

const missingTables = loadMissing();

export function isOptionalTableMissing(table: string): boolean {
  return missingTables.has(table);
}

export function markOptionalTableMissing(table: string): void {
  missingTables.add(table);
  saveMissing(missingTables);
}

/** True when the relation is missing or not exposed (PostgREST 404 / PGRST205). */
export function is404OrMissingTable(error: unknown, responseStatus?: number | null): boolean {
  if (responseStatus === 404) return true;
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const status = typeof e.status === "number" ? e.status : null;
  if (status === 404) return true;
  if (typeof (e as { statusCode?: number }).statusCode === "number" && (e as { statusCode: number }).statusCode === 404) {
    return true;
  }
  const code = typeof e.code === "string" ? e.code : "";
  // https://supabase.com/docs/guides/api/rest/postgrest-error-codes
  if (code === "PGRST205") return true; // table not in schema cache
  if (code === "42P01") return true; // undefined_table
  const msg = String(e.message ?? "").toLowerCase();
  if (msg.includes("schema cache") && msg.includes("could not find")) return true;
  if ((msg.includes("relation") || msg.includes("table")) && msg.includes("does not exist")) return true;
  return false;
}

/** Mark table missing only on 404 / missing-relation errors (not RLS or network). */
export function markOptionalTableMissingOnError(
  table: string,
  error: unknown,
  responseStatus?: number | null
): void {
  if (is404OrMissingTable(error, responseStatus)) {
    missingTables.add(table);
    saveMissing(missingTables);
  }
}

/** 406 e.g. from .single() when 0 rows, or table/column mismatch */
export function is406OrOptional(error: { code?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.status === 406) return true;
  if (typeof (error as any).statusCode === "number" && (error as any).statusCode === 406) return true;
  return false;
}
