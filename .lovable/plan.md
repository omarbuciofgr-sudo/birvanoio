## Goal

Make the dashboard Overview page customizable and add call + email timing analytics widgets (best hour to call/email, totals by hour, connect rate).

## New widgets

1. **Call Performance by Hour**
   - Source: `voice_agent_calls` (last 30 days, per-user via `client_id`).
   - Bar chart: total calls per hour of day (0–23, local time).
   - Line overlay: connect rate per hour = `completed / (completed + no_answer + failed)`.
   - Callout cards: **Best hour to call** (highest connect rate, min 3 calls), **Overall connect rate**, **Total calls (30d)**, **Avg duration**.

2. **Email Performance by Hour**
   - Source: `conversation_logs` where `type='email'` (last 30 days, per user).
   - Bar chart: total emails sent per hour.
   - Since open/reply events aren't tracked yet, reply rate = share of hours with an inbound email reply within 48h of an outbound one to the same `lead_id`. Show as line overlay.
   - Callout cards: **Best hour to email** (highest reply rate), **Reply rate**, **Total emails (30d)**.
   - Small note: "Open tracking coming soon" so the metric limitation is transparent.

3. Both widgets support a range toggle (7d / 30d / 90d) and a timezone note (uses browser local time).

## Customization

- Add a **"Customize"** button in the Overview header that opens a sheet listing all widgets with visibility toggles and drag-to-reorder handles (`@dnd-kit/core` is already in the project — verify; if not, use simple up/down buttons to avoid a dep).
- Widget catalog (existing + new): Stats cards, Weekly Activity, AI Smart Priority, AI Deal Forecast, AI Churn, AI Weekly Digest, Recent Leads, Notifications, **Call Performance by Hour**, **Email Performance by Hour**.
- Preferences persist in `localStorage` under `overview_layout_v1` keyed by user id: `{ order: string[], hidden: string[] }`. No schema change.
- "Reset to default" button in the sheet.

## Technical plan

New files:
- `src/components/dashboard/widgets/CallHourWidget.tsx` — fetches `voice_agent_calls`, buckets by hour, renders Recharts `ComposedChart` (bars + line).
- `src/components/dashboard/widgets/EmailHourWidget.tsx` — fetches `conversation_logs` (`type='email'`), computes hourly totals + reply-rate approximation.
- `src/components/dashboard/CustomizeOverviewSheet.tsx` — sheet UI, list of widgets with switches and reorder controls.
- `src/hooks/useOverviewLayout.ts` — read/write layout in localStorage, expose `order`, `hidden`, `toggle`, `move`, `reset`.

Edits:
- `src/pages/Dashboard.tsx` — wrap existing widget sections in an id-keyed registry; render in the order from `useOverviewLayout`; skip hidden ones; add "Customize" button in header; insert the two new widgets into the registry.

No DB migration, no new dependencies (Recharts + shadcn Sheet already in use). Verify with `tsgo`.

## Out of scope (call out to user)

- Real email open/click tracking (needs Resend/webhook plumbing) — flagged with "coming soon" copy.
- Cross-device sync of layout preference (would need a `user_preferences` table — can add in a follow-up).
