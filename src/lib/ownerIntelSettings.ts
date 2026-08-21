/**
 * User-tunable rules for the follow-up steps generated from listing intel,
 * plus the call/email scripts used for each signal. Stored locally so the
 * realtor can tweak thresholds and wording without a round trip.
 */

export type SignalId = "price_drop" | "relisted" | "stale" | "aging" | "fresh";

export type SignalScript = {
  enabled: boolean;
  /** Task kind — drives the icon and how the step is worked. */
  kind: "call" | "email" | "text" | "task";
  /** Days from now the step is due. */
  dueInDays: number;
  /** Task title (supports merge fields). */
  title: string;
  /** Script body shown when working the step (supports merge fields). */
  body: string;
};

export type IntelSettings = {
  /** Only count price cuts first seen within this many days. */
  priceDropWindowDays: number;
  /** Ignore cuts smaller than this percentage. */
  priceDropMinPct: number;
  /** Days on market at which a listing counts as aging. */
  agingThresholdDays: number;
  /** Days on market at which a listing counts as stale. */
  staleThresholdDays: number;
  /** Days on market at or below which a listing counts as fresh. */
  freshThresholdDays: number;
  /** Days the DOM counter must fall by to call a listing re-listed. */
  relistDomDropDays: number;
  signals: Record<SignalId, SignalScript>;
};

export const SIGNAL_LABELS: Record<SignalId, string> = {
  price_drop: "Price drop",
  relisted: "Re-listed",
  stale: "Stale (60+ days)",
  aging: "Aging listing",
  fresh: "Just listed",
};

export const MERGE_FIELDS: { token: string; description: string }[] = [
  { token: "{{address}}", description: "Property address" },
  { token: "{{owner_name}}", description: "Owner / client name" },
  { token: "{{price}}", description: "Current asking price" },
  { token: "{{price_drop}}", description: "Price-drop amount in dollars" },
  { token: "{{price_drop_pct}}", description: "Price drop as a percentage" },
  { token: "{{days_on_market}}", description: "Days on market" },
  { token: "{{agent_name}}", description: "Your name" },
];

export const DEFAULT_INTEL_SETTINGS: IntelSettings = {
  priceDropWindowDays: 30,
  priceDropMinPct: 1,
  agingThresholdDays: 30,
  staleThresholdDays: 60,
  freshThresholdDays: 7,
  relistDomDropDays: 7,
  signals: {
    price_drop: {
      enabled: true,
      kind: "call",
      dueInDays: 0,
      title: "Call {{owner_name}} about the price drop on {{address}}",
      body:
        "Hi {{owner_name}}, this is {{agent_name}}. I noticed the price on {{address}} came down {{price_drop}} ({{price_drop_pct}}%). " +
        "I work this area every day and have buyers looking in this range — can I walk you through what comparable homes are actually closing at?",
    },
    relisted: {
      enabled: true,
      kind: "call",
      dueInDays: 0,
      title: "Re-engage {{owner_name}} — {{address}} was re-listed",
      body:
        "Hi {{owner_name}}, {{agent_name}} here. I saw {{address}} back on the market. " +
        "When a listing resets like that it usually means a deal fell apart or an agreement expired. " +
        "I'd like ten minutes to show you what I'd do differently this time.",
    },
    stale: {
      enabled: true,
      kind: "email",
      dueInDays: 1,
      title: "Send a market update for {{address}}",
      body:
        "Hi {{owner_name}},\n\n{{address}} has been on the market {{days_on_market}} days. " +
        "I pulled the most recent comparable sales and days-on-market data for your block and would be glad to share it — no obligation.\n\n" +
        "Would a quick pricing conversation this week be useful?\n\n{{agent_name}}",
    },
    aging: {
      enabled: true,
      kind: "task",
      dueInDays: 3,
      title: "Check in on {{address}} before it goes stale",
      body:
        "Soft check-in with {{owner_name}} on {{address}} ({{days_on_market}} days on market). " +
        "Lead with market activity, not a pitch — the goal is to be the agent they call before they cut the price.",
    },
    fresh: {
      enabled: true,
      kind: "call",
      dueInDays: 0,
      title: "Be first to call on {{address}}",
      body:
        "Hi {{owner_name}}, this is {{agent_name}}. I saw you just listed {{address}} at {{price}}. " +
        "I have buyers active in the neighborhood right now — would you be open to working with an agent who brings them to you?",
    },
  },
};

const KEY = "brivano.intel_settings.v1";

export function loadIntelSettings(): IntelSettings {
  if (typeof window === "undefined") return DEFAULT_INTEL_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_INTEL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<IntelSettings>;
    return {
      ...DEFAULT_INTEL_SETTINGS,
      ...parsed,
      signals: {
        ...DEFAULT_INTEL_SETTINGS.signals,
        ...(parsed.signals ?? {}),
      },
    };
  } catch {
    return DEFAULT_INTEL_SETTINGS;
  }
}

export function saveIntelSettings(settings: IntelSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage disabled — defaults keep working */
  }
}

export type MergeContext = {
  address?: string | null;
  owner_name?: string | null;
  price?: string | number | null;
  price_drop?: number | null;
  price_drop_pct?: number | null;
  days_on_market?: number | null;
  agent_name?: string | null;
};

const dollars = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Replace every {{merge_field}} in a script with the values we know. */
export function renderScript(template: string, ctx: MergeContext): string {
  const values: Record<string, string> = {
    address: ctx.address?.trim() || "this listing",
    owner_name: ctx.owner_name?.trim() || "there",
    price:
      typeof ctx.price === "number"
        ? dollars(ctx.price)
        : (ctx.price ?? "").toString().trim() || "the asking price",
    price_drop: typeof ctx.price_drop === "number" ? dollars(ctx.price_drop) : "the recent cut",
    price_drop_pct: ctx.price_drop_pct != null ? String(ctx.price_drop_pct) : "",
    days_on_market: ctx.days_on_market != null ? String(ctx.days_on_market) : "several",
    agent_name: ctx.agent_name?.trim() || "your agent",
  };
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => {
    const v = values[key.toLowerCase()];
    return v === undefined ? match : v;
  });
}
