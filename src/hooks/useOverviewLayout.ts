import { useCallback, useEffect, useState } from "react";

export type WidgetId =
  | "kpis"
  | "quickActions"
  | "pipelineActivity"
  | "pipelineFunnel"
  | "callHour"
  | "emailHour"
  | "activity"
  | "notifications"
  | "recentLeads"
  | "aiInsights";

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
}

export const WIDGET_CATALOG: WidgetMeta[] = [
  { id: "quickActions", label: "Quick Actions", description: "Shortcut tiles to core workflows" },
  { id: "kpis", label: "KPI Cards", description: "Total leads, contact rate, win rate, scraped" },
  { id: "pipelineActivity", label: "Pipeline Activity", description: "7-day area chart of leads and conversions" },
  { id: "pipelineFunnel", label: "Pipeline Funnel", description: "Donut breakdown of pipeline stages" },
  { id: "callHour", label: "Call Performance by Hour", description: "Best hour to call and connect rate by hour" },
  { id: "emailHour", label: "Email Performance by Hour", description: "Best hour to email and reply rate by hour" },
  { id: "activity", label: "Activity Feed", description: "Latest team and lead activity" },
  { id: "notifications", label: "Notifications", description: "Unread alerts and system messages" },
  { id: "recentLeads", label: "Recent Leads", description: "Newest leads across CRM and Scout" },
  { id: "aiInsights", label: "AI Insights", description: "Digest, forecast, priority, churn" },
];

const DEFAULT_ORDER: WidgetId[] = WIDGET_CATALOG.map((w) => w.id);

interface Layout {
  order: WidgetId[];
  hidden: WidgetId[];
}

const KEY = "overview_layout_v1";

const readLayout = (userId: string | undefined): Layout => {
  if (typeof window === "undefined") return { order: DEFAULT_ORDER, hidden: [] };
  try {
    const raw = window.localStorage.getItem(`${KEY}:${userId ?? "anon"}`);
    if (!raw) return { order: DEFAULT_ORDER, hidden: [] };
    const parsed = JSON.parse(raw) as Layout;
    // Merge with catalog to pick up newly added widgets
    const known = new Set(DEFAULT_ORDER);
    const filteredOrder = parsed.order.filter((id) => known.has(id));
    const missing = DEFAULT_ORDER.filter((id) => !filteredOrder.includes(id));
    return { order: [...filteredOrder, ...missing], hidden: (parsed.hidden ?? []).filter((id) => known.has(id)) };
  } catch {
    return { order: DEFAULT_ORDER, hidden: [] };
  }
};

export function useOverviewLayout(userId: string | undefined) {
  const [layout, setLayout] = useState<Layout>(() => readLayout(userId));

  useEffect(() => {
    setLayout(readLayout(userId));
  }, [userId]);

  const persist = useCallback(
    (next: Layout) => {
      setLayout(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`${KEY}:${userId ?? "anon"}`, JSON.stringify(next));
      }
    },
    [userId]
  );

  const toggle = useCallback(
    (id: WidgetId) => {
      const hidden = layout.hidden.includes(id)
        ? layout.hidden.filter((x) => x !== id)
        : [...layout.hidden, id];
      persist({ ...layout, hidden });
    },
    [layout, persist]
  );

  const move = useCallback(
    (id: WidgetId, dir: -1 | 1) => {
      const idx = layout.order.indexOf(id);
      if (idx < 0) return;
      const target = idx + dir;
      if (target < 0 || target >= layout.order.length) return;
      const order = [...layout.order];
      [order[idx], order[target]] = [order[target], order[idx]];
      persist({ ...layout, order });
    },
    [layout, persist]
  );

  const reset = useCallback(() => {
    persist({ order: DEFAULT_ORDER, hidden: [] });
  }, [persist]);

  const isVisible = useCallback((id: WidgetId) => !layout.hidden.includes(id), [layout.hidden]);

  return { order: layout.order, hidden: layout.hidden, toggle, move, reset, isVisible };
}
