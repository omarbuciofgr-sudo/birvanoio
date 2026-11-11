/** Turns any stored owner name value (string, BatchData name object, junk) into display text or null. */
export function ownerNameText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
    return s(v.full) || [s(v.first), s(v.last)].filter(Boolean).join(" ") || s(v.fullName) || null;
  }
  return null;
}
