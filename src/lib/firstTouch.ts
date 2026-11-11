const KEY = "brivano_first_touch";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/** Builds the first-touch record from the current page; same-site referrers are blanked. */
export function buildFirstTouch(href: string, referrer: string, now = new Date()) {
  const url = new URL(href);
  let ref = referrer || "";
  try { if (ref && new URL(ref).host === url.host) ref = ""; } catch { ref = ""; }
  const out: Record<string, string> = { referrer: ref };
  for (const k of UTM) out[k] = url.searchParams.get(k) || "";
  out.landing_path = url.pathname;
  out.captured_at = now.toISOString();
  return out;
}

export function captureFirstTouch() {
  try {
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, JSON.stringify(buildFirstTouch(window.location.href, document.referrer)));
  } catch { /* storage unavailable */ }
}

export function readFirstTouch(): Record<string, unknown> | null {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
