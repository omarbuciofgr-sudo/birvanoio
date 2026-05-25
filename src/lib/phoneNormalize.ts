/** Drop booleans and placeholder strings providers sometimes send instead of dialable numbers. */
export function normalizePhoneField(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return '';
  const s = String(value).trim();
  if (!s || /^(true|false|null|none)$/i.test(s)) return '';
  const digits = s.replace(/\D/g, '');
  if (digits.length < 7) return '';
  return s;
}
