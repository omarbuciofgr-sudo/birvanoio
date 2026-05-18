/**
 * People Search → CompanyResult: Apollo sometimes omits `organization_name` while
 * `title` / `headline` still contain a human-readable "… at {Employer}" fragment.
 * We only parse a trailing ` at {rest}` (case-insensitive) — no NLP, single source at map time.
 */

export type PersonOrgFallbackInput = {
  organization_name?: string | null;
  title?: string | null;
  headline?: string | null;
};

/** Returns text after the last `" at "` if present and non-empty; otherwise null. */
export function parseEmployerFromAtSuffix(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  const marker = ' at ';
  const idx = t.toLowerCase().lastIndexOf(marker);
  if (idx === -1) return null;
  const right = t.slice(idx + marker.length).trim();
  return right || null;
}

/**
 * Canonical employer string for preview + enrichment gates: prefer API field, else
 * `headline`, then `title`, using the ` at ` suffix heuristic only when direct org is empty.
 */
export function resolvePersonOrganizationName(p: PersonOrgFallbackInput): string | null {
  const direct = (p.organization_name || '').trim();
  if (direct) return direct;
  const fromHeadline = parseEmployerFromAtSuffix(p.headline);
  if (fromHeadline) return fromHeadline;
  const fromTitle = parseEmployerFromAtSuffix(p.title);
  if (fromTitle) return fromTitle;
  return null;
}
