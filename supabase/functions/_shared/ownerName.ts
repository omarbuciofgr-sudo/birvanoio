/** Owner name stored on listings must be a plain string or null, never a name object. */
export function ownerNameString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    const s = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null);
    return s(v.full) || [s(v.first), s(v.last)].filter(Boolean).join(' ') || s(v.fullName) || null;
  }
  return null;
}
