# Supabase setup for Brivano Scout

## Two tables involved

| Table | Who writes to it | Purpose |
|------|-------------------|--------|
| **hotpads_listings** | Scraper backend (Python) | Raw HotPads scrape results. Listings you see on the frontend come from here (or CSV fallback). |
| **scraped_leads** | Frontend (when "Save to Database" is on) | Main app lead pipeline (used by Leads, enrichment, etc.). |

## hotpads_listings (scraper data)

- Created by the scraper setup (e.g. `Scraper_backend/Hotpads_Scraper/supabase_setup.sql`) in your Supabase project.
- The backend API reads from this table for **Last result** so the frontend count matches the DB.
- If you get permission errors when the scraper runs or when loading listings, ensure this table exists and either:
  - RLS is disabled for it, or  
  - Your `SUPABASE_SERVICE_KEY` (or service role key) has access.

You’ve already **unrestricted** this table (RLS disabled), so scraper writes and API reads should work.

## scraped_leads (Save to Database in the UI)

- Used when you turn **Save to Database** ON and click **Find Listings** (or save a single listing).
- This table is created by the **birvanoio** Supabase migrations, not by the scraper.

If you see a toast like:  
**"Database table 'scraped_leads' not found"** (or a 404 in the console for `.../scraped_leads`):

**Option A – Quick fix (one script)**  
1. Open your Supabase project (the one in `VITE_SUPABASE_URL` in `birvanoio/.env`).  
2. Go to **SQL Editor** and run the script:  
   `birvanoio/supabase/scripts/create_scraped_leads_standalone.sql`  
   (Copy the file contents into a new query and run it.)  
3. This creates the `scraped_leads` table and dependencies so **Save to Database** works.

**Option B – Full migrations**  
1. In the **birvanoio** folder, run:  
   `npx supabase db push`  
   so all migrations run in the same Supabase project your app uses.  
2. Or apply the SQL files in `supabase/migrations/` from the Supabase dashboard (SQL Editor) in date order.

Until `scraped_leads` exists, listings will still load and display from **hotpads_listings**; only the “Save to Database” action (into the leads pipeline) will fail with that message.
