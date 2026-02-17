/**
 * Optional Supabase tables that may not exist yet (e.g. before migrations).
 * Once we get an error for a table, we skip further requests (persisted in sessionStorage for the tab).
 */

const STORAGE_KEY = "supabase_optional_tables_missing";

function loadMissing(): Set<string> {
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

export function is404OrMissingTable(error: { code?: string; status?: number; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST116") return true; // relation does not exist
  if (error.status === 404) return true;
  if (typeof (error as any).statusCode === "number" && (error as any).statusCode === 404) return true;
  if (error.message?.includes("404") || error.message?.toLowerCase().includes("not find")) return true;
  return false;
}

/** Mark table missing on any error (use for optional tables to stop all further requests). */
export function markOptionalTableMissingOnError(table: string, error: unknown): void {
  if (error) {
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
