/**
 * Branded flyer templates. Values are plain CSS (not design tokens) on purpose:
 * the flyer is printed in a detached window and represents the agent's brand,
 * not the app theme.
 */
export type FlyerLayout = "editorial" | "banner" | "split";

export type FlyerTheme = {
  id: string;
  name: string;
  description: string;
  layout: FlyerLayout;
  /** Page background. */
  bg: string;
  /** Primary text color. */
  fg: string;
  /** Muted text color. */
  muted: string;
  /** Accent used for the headline strip, price and bullets. */
  accent: string;
  /** Text placed on top of the accent color. */
  accentFg: string;
  /** Panel / card fill. */
  surface: string;
  border: string;
  headingFont: string;
  bodyFont: string;
  /** Corner radius in px used across photo and panels. */
  radius: number;
  /** Uppercase tracking treatment for the eyebrow headline. */
  eyebrowTracking: string;
};

export const FLYER_TEMPLATES: FlyerTheme[] = [
  {
    id: "editorial",
    name: "Editorial",
    description: "Serif headlines, generous white space.",
    layout: "editorial",
    bg: "#ffffff",
    fg: "#111111",
    muted: "#6b6b6b",
    accent: "#1e3a5f",
    accentFg: "#ffffff",
    surface: "#f4f5f7",
    border: "#e3e5e9",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Inter, system-ui, sans-serif",
    radius: 8,
    eyebrowTracking: "0.35em",
  },
  {
    id: "bold",
    name: "Bold Banner",
    description: "Full-width color band, high-impact type.",
    layout: "banner",
    bg: "#ffffff",
    fg: "#0f172a",
    muted: "#64748b",
    accent: "#e85d3a",
    accentFg: "#ffffff",
    surface: "#fdf1ec",
    border: "#f3d9cf",
    headingFont: "'Space Grotesk', Inter, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    radius: 4,
    eyebrowTracking: "0.28em",
  },
  {
    id: "noir",
    name: "Noir & Gold",
    description: "Dark luxury layout for premium listings.",
    layout: "editorial",
    bg: "#0d0d0d",
    fg: "#f7f5ef",
    muted: "#9d9a91",
    accent: "#c9a84c",
    accentFg: "#0d0d0d",
    surface: "#1a1a1a",
    border: "#2b2b2b",
    headingFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "Inter, system-ui, sans-serif",
    radius: 2,
    eyebrowTracking: "0.4em",
  },
  {
    id: "sand",
    name: "Warm Sand",
    description: "Soft neutrals, friendly and residential.",
    layout: "split",
    bg: "#faf8f5",
    fg: "#3a3229",
    muted: "#8b7355",
    accent: "#c4654a",
    accentFg: "#ffffff",
    surface: "#f0ebe3",
    border: "#e2d9cb",
    headingFont: "'Space Grotesk', Inter, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    radius: 14,
    eyebrowTracking: "0.3em",
  },
  {
    id: "coastal",
    name: "Coastal",
    description: "Cool blues with a clean modern grid.",
    layout: "split",
    bg: "#ffffff",
    fg: "#0c2340",
    muted: "#5b7285",
    accent: "#2d8a9e",
    accentFg: "#ffffff",
    surface: "#eef6f8",
    border: "#d5e6ea",
    headingFont: "'Space Grotesk', Inter, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    radius: 10,
    eyebrowTracking: "0.3em",
  },
  {
    id: "mono",
    name: "Minimal Mono",
    description: "Black and white, no distractions.",
    layout: "banner",
    bg: "#ffffff",
    fg: "#0a0a0a",
    muted: "#767676",
    accent: "#0a0a0a",
    accentFg: "#ffffff",
    surface: "#f2f2f2",
    border: "#dcdcdc",
    headingFont: "Inter, system-ui, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    radius: 0,
    eyebrowTracking: "0.42em",
  },
];

export const DEFAULT_TEMPLATE_ID = "editorial";

export function getTemplate(id: string | undefined): FlyerTheme {
  return FLYER_TEMPLATES.find((t) => t.id === id) || FLYER_TEMPLATES[0];
}

/** Applies the agent's brand overrides (accent + fonts) on top of a template. */
export function applyBranding(
  theme: FlyerTheme,
  brand: { accent?: string; headingFont?: string },
): FlyerTheme {
  return {
    ...theme,
    accent: brand.accent?.trim() || theme.accent,
    headingFont: brand.headingFont?.trim() || theme.headingFont,
  };
}

export const HEADING_FONT_OPTIONS = [
  { id: "", label: "Template default" },
  { id: "'Space Grotesk', Inter, sans-serif", label: "Space Grotesk — modern" },
  { id: "Inter, system-ui, sans-serif", label: "Inter — neutral" },
  { id: "Georgia, 'Times New Roman', serif", label: "Georgia — classic serif" },
  { id: "'Times New Roman', Georgia, serif", label: "Times — traditional" },
  { id: "'Trebuchet MS', Inter, sans-serif", label: "Trebuchet — friendly" },
];
