## Goal

Clicking a lead or a company opens a full-screen detail page (Salesforce/Outreach style) with the full contact context, activity, and quick actions — replacing the current side sheet on Leads and upgrading the current Accounts detail page.

## Lead detail — new page `/dashboard/leads/:id`

- **Header**: avatar, name, title, company (linked to account page), status pill, lead score, owner. Actions: **Add to Sequence** (reuses `AddToCampaignDialog`), **Call**, **Email**, **SMS**, **Edit**.
- **Left rail — About**:
  - Contact info: email, phone, LinkedIn, website (click-to-copy, mailto/tel links).
  - **Local time** in the prospect's timezone with a live clock. Timezone derived from (in order) phone country code → US state map → country default. Show source hint on hover; "Unknown timezone" fallback.
  - Prospect notes (editable, persisted to `leads.notes`).
  - Sequences enrolled in (from `lead_campaign_enrollments`).
  - Lead score details, tags, owner, created / last-contacted timestamps.
- **Main — tabs**:
  - **Activity** — combined feed (reuses `LeadActivityTimeline`).
  - **Emails** — outbound + inbound from `conversation_logs` where `type='email'`.
  - **Calls** — from `voice_agent_calls` and `conversation_logs` where `type='call'` (with duration, outcome, recording link if present).
  - **SMS** — `conversation_logs` where `type='sms'`.
  - **Notes** — extended notes editor with timestamps.
  - **Tasks** — scheduled follow-ups (reuses existing scheduled_messages if present, else placeholder).
- Route: `/dashboard/leads/:id`. Row click and name click on `Leads.tsx` navigate here instead of opening the Sheet. Bulk-select behavior stays.

## Account (company) detail — upgrade existing `/dashboard/accounts/:name`

- **Header**: company logo (Google favicon), name, industry, website, HQ, top-lead score. Actions: **Add to Sequence** (bulk-enrolls all leads in the account), **Export CSV**, **Back**.
- **Left rail — About**: industry, size, revenue if available, HQ, primary domain, domain-merge hint, account notes (localStorage per-user for Phase 1 — Phase 2 will migrate to a real `accounts` table per the earlier plan).
- **Main — tabs**:
  - **Leads** — associated leads table; clicking a row navigates to `/dashboard/leads/:id`.
  - **Activity** — combined feed for all leads in the account.
  - **Emails** — `conversation_logs` (type='email') joined across the account's lead IDs.
  - **Calls** — `voice_agent_calls` + `conversation_logs` (type='call') across the account's lead IDs.
  - **Notes** — account-level notes (localStorage for now).
  - **Opportunities** — from `deals` table filtered by the account's lead IDs.

## Technical plan

New files:
- `src/pages/LeadDetail.tsx` — full-page layout, fetches lead + related activity, wires actions.
- `src/lib/leadTimezone.ts` — pure helper: `(lead) => { tz: string | null, source: 'phone' | 'state' | 'country' | null }`. Static maps for US states and common countries; phone → country via first digits.
- `src/components/leads/SequenceEnrollments.tsx` — reads `lead_campaign_enrollments` for a lead id.
- `src/components/leads/LocalTimeClock.tsx` — renders a live clock in a given IANA tz.

Edits:
- `src/App.tsx` — register `/dashboard/leads/:id` route.
- `src/pages/Leads.tsx` — row click and name click navigate to `/dashboard/leads/:id`; remove/replace the Sheet drawer (keep bulk actions).
- `src/pages/AccountDetail.tsx` — expand header with actions; add Emails / Calls / Opportunities tabs sourced from lead-ID joins; make Leads rows navigate to the new lead detail page.

No new dependencies. No schema changes. Verify with `tsgo`.

## Out of scope (call out to user)

- Persistent account-level notes (still localStorage until the `accounts` table lands in Phase 2).
- Real timezone resolution from lat/lng (requires a geocoding call) — the static map covers US + top countries and is instantly available.
- Two-way email/calendar sync — Emails tab reads whatever is already in `conversation_logs`.
