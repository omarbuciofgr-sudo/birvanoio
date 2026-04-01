export type PlatformConfigEntry = {
  label: string;
  domain: string;
  color: string;
  /** Bundled under `public/platform-logos/` — no remote favicon requests */
  logo: string;
};

const PLATFORM_CONFIG: Record<string, PlatformConfigEntry> = {
  zillow: {
    label: 'Zillow (FSBO)',
    domain: 'zillow.com',
    color: '#006AFF',
    logo: '/platform-logos/zillow.svg',
  },
  zillow_frbo: {
    label: 'Zillow (FRBO)',
    domain: 'zillow.com',
    color: '#006AFF',
    logo: '/platform-logos/zillow.svg',
  },
  fsbo: {
    label: 'FSBO.com',
    domain: 'fsbo.com',
    color: '#2D8C3C',
    logo: '/platform-logos/fsbo.svg',
  },
  trulia: {
    label: 'Trulia',
    domain: 'trulia.com',
    color: '#1FB6A8',
    logo: '/platform-logos/trulia.svg',
  },
  apartments: {
    label: 'Apartments.com',
    domain: 'apartments.com',
    color: '#65AC1E',
    logo: '/platform-logos/apartments.svg',
  },
  hotpads: {
    label: 'HotPads',
    domain: 'hotpads.com',
    color: '#FF6347',
    logo: '/platform-logos/hotpads.svg',
  },
};

/** Maps DB / API `source_platform` values to dropdown keys */
const LISTING_PLATFORM_TO_CONFIG_KEY: Record<string, keyof typeof PLATFORM_CONFIG> = {
  zillow_fsbo: 'zillow',
  zillow_frbo: 'zillow_frbo',
  fsbo: 'fsbo',
  trulia: 'trulia',
  apartments: 'apartments',
  hotpads: 'hotpads',
};

export function getPlatformLogo(platformKey: string): string | null {
  const config = PLATFORM_CONFIG[platformKey.toLowerCase()];
  return config?.logo ?? null;
}

export function getPlatformLogoFromUrl(sourceUrl: string): string | null {
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
    if (hostname.includes('zillow')) return PLATFORM_CONFIG.zillow.logo;
    if (hostname.includes('trulia')) return PLATFORM_CONFIG.trulia.logo;
    if (hostname.includes('hotpads')) return PLATFORM_CONFIG.hotpads.logo;
    if (hostname.includes('apartments')) return PLATFORM_CONFIG.apartments.logo;
    if (hostname.includes('fsbo')) return PLATFORM_CONFIG.fsbo.logo;
  } catch {
    /* ignore */
  }
  return null;
}

/** Logo + fallback letter for listing cards (uses `source_platform` + URL). */
export function resolveListingPlatformMark(
  sourcePlatform: string | null | undefined,
  sourceUrl: string | null | undefined,
): { logo: string | null; fallback: string; title: string } {
  const sp = (sourcePlatform || '').toLowerCase();
  const key = LISTING_PLATFORM_TO_CONFIG_KEY[sp];
  if (key) {
    const c = PLATFORM_CONFIG[key];
    return {
      logo: c.logo,
      fallback: c.domain.charAt(0).toUpperCase(),
      title: c.domain,
    };
  }
  const fromUrl = sourceUrl ? getPlatformLogoFromUrl(sourceUrl) : null;
  let host = '';
  try {
    if (sourceUrl) host = new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    /* ignore */
  }
  const ch =
    host && /^[a-z0-9]/i.test(host)
      ? host.charAt(0)
      : (sourcePlatform || '?').charAt(0);
  return {
    logo: fromUrl,
    fallback: ch.toUpperCase(),
    title: host || sourcePlatform || '',
  };
}

export function getPlatformColor(platformKey: string): string {
  return PLATFORM_CONFIG[platformKey.toLowerCase()]?.color || '#6B7280';
}

export function getPlatformLabel(platformKey: string): string {
  return PLATFORM_CONFIG[platformKey.toLowerCase()]?.label || platformKey;
}

export { PLATFORM_CONFIG };
