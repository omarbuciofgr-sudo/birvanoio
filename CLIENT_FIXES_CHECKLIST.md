# Client Fixes Checklist — What to Exclude vs What to Fix

---

## Message for client (copy / send)

Hi — quick update on the work I did.

All your Brivano Scout scrapers (Hotpads, Trulia, Redfin, Zillow, FSBO, Apartments, etc.) and the skip trace / Batch Data side are working fine, so I left those exactly as they are. The other screens you asked to fix are all done: the dashboard shows real numbers (including your Scraped Leads count and the pipeline activity chart), the Activity section shows recent activity (or recent leads when there’s no activity log), and when you use Find people / prospect search and save to leads, the contact name and email are saved correctly to Scraped Leads. On the Scraped Leads admin page you can filter by source and search by name, email, domain, or phone, and the Reports screen uses your real lead data. The Search tab filters (All, Companies, People, Local) are wired up and sent to the search as intended.

If you want to tweak anything or add the email recap feature later, I can do that in a follow-up. Thanks.

---

## DO NOT TOUCH (working fine per client)

- **Brivano Scout — Real Estate tab**  
  All listing scrapers (Hotpads, Trulia, Redfin, Zillow FSBO/FRBO, FSBO.com, Apartments.com, All Platforms). No changes.

- **Skip trace**  
  Batch Data / skip-trace logic and API. Not modified.

- **Scraper backends**  
  `Scraper_backend/`, Python/Node scrapers, `api_server.py`. Not modified.

- **Scraper-related Edge Functions**  
  `fsbo-scrape-and-trace`, `scrape-real-estate`, `tracerfy-skip-trace`, `process-scrape-job`, `enrich-lead` (for scraper flows). Not modified.

- **Scraper admin**  
  Scrape Jobs, Scraper Settings, Schema Templates. Not modified.

---

## DONE (other screens per client)

1. **Dashboard — Scraped Leads number**  
   - Added fetch of `scraped_leads` count and a **Scraped Leads** KPI card (clickable to `/admin/scraped-leads`).  
   - Dashboard now shows the scraper lead number.

2. **Scraped Leads display**  
   - Admin Scraped Leads table already shows Contact (`full_name`) and Email (`best_email`).

3. **Brivano Lens — Find people → contact name & email in Scraped Leads**  
   - **ProspectSearchDialog.tsx:** Find people now tries `prospectSearchApi.search()` first (Apollo + enrichment). When it returns data, results are shown and `prospectResults` is set; on “Save as leads” we call `saveProspectsAsLeads(selectedProspects)` so `full_name`, `best_email`, `best_phone` are written to `scraped_leads`. If prospect-search returns nothing, we fall back to `industrySearchApi.searchPeople()` and map people to `CompanyResult` with optional `email`/`phone`; save uses `saveAsLeads(selected)`.  
   - **industrySearch.ts:** `PersonResult` has optional `email` and `phone`; people→CompanyResult mapping includes them. `CompanyResult` has optional `email`; `saveAsLeads()` now writes `full_name`, `best_email`, `all_emails`, `best_phone`, `all_phones` when present so contact name and email/phone appear in Scraped Leads.

---

## DONE (continued — all client “other screens” items)

4. **Dashboard — Real pipeline activity**  
   - Pipeline Activity chart uses real data from `leads` (last 30 days fetch; 7-day window — last 7 days or 7 days ending on most recent lead so chart shows bars when there is data). No mock/random data.

5. **Dashboard — Activity feed**  
   - When `team_activity_log` is empty, Activity widget shows recent leads as “Lead [name] added” so the section is never empty when leads exist.

6. **Search tab (Brivano Scout)**  
   - Filter buttons (All, Companies, People, Local) set `searchCategory`; it is passed as `options.category` to the Firecrawl search request in WebScraper.tsx.

7. **Scraped Leads — Sources & search**  
   - Source filter includes: All Sources, Brivano Scout (Real Estate), Prospect Search, Industry Search (Companies / People), Google Places, Apollo, Firecrawl, Web Scraper.  
   - Search runs over: domain, full_name, best_email, best_phone, address.  
   - Table shows Contact (`full_name`) and Email (`best_email`).

8. **Reports — Actual data**  
   - Overview metrics and Performance chart use real `leads` data (`buildPerformanceDataFromLeads`), 14-day window with fallback to most recent lead when needed.

---

## EXCLUDED (per client / scope)

- **Scrapers & skip trace:** Real Estate tab scrapers and Batch Data skip trace — not modified; client says working fine.  
- **Email generate AI recap:** Separate feature; out of scope for “other screens” fixes.

---

## Verification summary

| Item | Status |
|------|--------|
| Scrapers / skip trace | Excluded — no code changes |
| Find people → Scraped Leads (contact name & email) | Implemented (ProspectSearchDialog + industrySearch saveAsLeads) |
| Dashboard Scraped Leads count | Implemented |
| Dashboard Pipeline Activity chart | Real data from `leads` |
| Dashboard Activity feed | Real data; fallback to recent leads when activity log empty |
| Search tab category (All/Companies/People/Local) | Wired to Firecrawl |
| Scraped Leads source filter & search | Implemented (source_type + search on name/email/domain/phone/address) |
| Reports actual data | Implemented |

---

*Scraper logic and skip trace are excluded. All other client “other screens” and save/display flows above are implemented.*
