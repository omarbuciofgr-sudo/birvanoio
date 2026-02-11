// Platform logo URLs using Google's favicon service
const PLATFORM_CONFIG: Record<string, { label: string; domain: string; color: string }> = {
  zillow: { label: 'Zillow', domain: 'zillow.com', color: '#006AFF' },
  fsbo: { label: 'FSBO.com', domain: 'fsbo.com', color: '#2D8C3C' },
  trulia: { label: 'Trulia', domain: 'trulia.com', color: '#1FB6A8' },
  redfin: { label: 'Redfin', domain: 'redfin.com', color: '#A02021' },
  apartments: { label: 'Apartments.com', domain: 'apartments.com', color: '#65AC1E' },
  hotpads: { label: 'HotPads', domain: 'hotpads.com', color: '#FF6347' },
  realtor: { label: 'Realtor.com', domain: 'realtor.com', color: '#D92228' },
};

export function getPlatformLogo(platformKey: string): string | null {
  const config = PLATFORM_CONFIG[platformKey.toLowerCase()];
  if (!config) return null;
  return `https://www.google.com/s2/favicons?domain=${config.domain}&sz=32`;
}

export function getPlatformLogoFromUrl(sourceUrl: string): string | null {
  try {
    const hostname = new URL(sourceUrl).hostname.replace('www.', '');
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

export function getPlatformColor(platformKey: string): string {
  return PLATFORM_CONFIG[platformKey.toLowerCase()]?.color || '#6B7280';
}

export function getPlatformLabel(platformKey: string): string {
  return PLATFORM_CONFIG[platformKey.toLowerCase()]?.label || platformKey;
}

export { PLATFORM_CONFIG };
