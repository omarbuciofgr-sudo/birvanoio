## Accounts (Companies) view

### Goal
Give users an "Accounts" surface to browse companies and drill into all leads for a given company, without introducing a new database entity yet.

### Scope
- **Phase 1 (now):** grouped view derived from the existing `leads` table. No schema changes.
- **Phase 2 (later, separate request):** a real `accounts` table that owns companies independently and links leads via `account_id`.

### What ships in Phase 1

**1. New page `/dashboard/accounts`**
- Lists every distinct company aggregated from `leads.business_name` (case-insensitive, trimmed).
- Per-row summary: company name, lead count, primary industry, locations (top 1–2), top lead score, status breakdown mini-bar, last activity date.
- Search box + filters (industry, state, has-hot-lead).
- Sort by lead count / top score / last activity / name.
- Domain merge hint: when leads under the same normalized name have >1 distinct email/website domain, show a small "multiple domains" badge on the row so users can spot merge candidates. Grouping itself remains name-based.

**2. Account detail view `/dashboard/accounts/:name`**
- Header: company name, aggregate stats (leads, hot leads, converted, last activity), list of detected domains.
- Tabs:
  - **Leads** — table of all leads for that company (reuses the same columns/logic as the Leads table). Row click opens the existing lead detail sheet.
  - **Activity** — merged timeline of recent lead activity for the company (best-effort using existing `LeadActivityTimeline` data joined across the account's leads).
  - **Notes** — company-level notes stored client-side for now (localStorage keyed by normalized name) with a note that persistent account notes arrive with Phase 2.
- Header actions: "Add to Campaign" (uses the existing `AddToCampaignDialog` with all account lead IDs), "Export CSV", "Back to Accounts".

**3. Navigation**
- Add a top-level **Accounts** item in the sidebar under Core, right below Leads (icon: `Building2`).
- Keep the existing Companies toggle on the Leads page; clicking a company card there now navigates to `/dashboard/accounts/:name` instead of just filtering the table.

### What does NOT change in Phase 1
- No new tables, RLS, or migrations.
- No changes to how leads are created or linked.
- Campaigns, scoring, and other pages are untouched.

### Phase 2 preview (not built now)
When you're ready: add `accounts` table (name, domain, industry, website, owner, notes), add `account_id` FK on `leads`, backfill from current grouping, and switch the Accounts page to read from the table so you can create empty companies and edit them.

---

### Technical notes
- New route in `src/App.tsx`: `/dashboard/accounts` and `/dashboard/accounts/:name` (URL-encoded name), both wrapped in `ProtectedRoute`.
- New files: `src/pages/Accounts.tsx`, `src/pages/AccountDetail.tsx`.
- Sidebar item added in `src/components/dashboard/DashboardLayout.tsx` (Core group).
- Grouping helper reused/extracted from the existing `companies` memo in `src/pages/Leads.tsx`.
- No new dependencies.
