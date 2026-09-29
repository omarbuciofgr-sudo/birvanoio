# Roadmap

- [x] Add Find Owners as the first Real Estate sidebar tool
- [x] Rework the Scout Real Estate search controls and user-facing language
- [x] Rename actions, filters, table columns, and empty state
- [x] Add dynamic credit costs to credit-consuming actions
- [x] Replace raw errors with a safe message and admin logging
- [x] Diagnose and fix My past searches connectivity
- [x] Verify desktop behavior and build health

## Real estate landing page
- [x] Rewrite hero with supplied real estate copy and CTAs
- [x] Replace numeric stats with three-step workflow
- [x] Remove competitor comparison, ROI calculator, and broad use-case section
- [x] Add existing AI feature section and mark Voice Agent Beta
- [x] Add Who we help nav dropdown and three audience pages
- [x] Update public and dashboard browser titles
- [x] Verify landing page and routes

## Real Estate workspace
- [x] Limit the Real Estate sidebar to five ordered items
- [x] Consolidate Campaigns, Sequences, and Templates under Outreach tabs
- [x] Put the Pipeline board toggle inside My Leads
- [x] Add server-validated admin route protection
- [x] Verify database policies, signed-out route denial, and build health
- [x] Verify signed-in Real Estate navigation and non-admin route denial (blocked: no matching preview account)

## New-user Home dashboard
- [x] Replace KPI cards with an automatic Get started checklist below five saved leads
- [x] Remove fabricated trend badges
- [x] Gate advanced AI and hourly performance widgets until 14 days of activity
- [x] Show remaining credits with a Billing link
- [x] Verify type safety and build health
- [x] Verify signed-in new-user and established-user states (blocked: no matching preview account)

## Data consistency
- [x] Use one shared leads query for Home, My Leads, and Reports totals
- [x] Prevent empty-state flashes and replace Voice Agent loading text with skeletons
- [x] Remove subscription management from Settings
- [x] Verify affected signed-in pages in the browser (blocked: preview account access required)

## Credit pricing and fair use
- [x] Centralize plan allowances, action costs, fair-use limits, cache TTL, and add-on pricing
- [x] Align landing Pricing and Billing with the centralized rules
- [x] Enforce successful-action charging and AI fair-use limits server-side
- [x] Reuse matching city searches for 24 hours
- [x] Show credit costs on every credit-spending action
- [x] Verify types, build, and key pricing flows
- [x] Centralize plan allowances, action costs, AI message limits, and add-on pricing in database settings
- [x] Update landing pricing and Billing plan displays with real-estate descriptions and credit explanations
- [x] Charge city searches, successful owner contact lookups, SMS, and voice minutes from centralized costs
- [x] Keep AI messages credit-free while enforcing monthly per-seat fair-use limits
- [x] Show AI message monthly usage in Billing and clear limit messaging
- [x] Add 500-credit / $25 add-on purchase option
- [x] Cache city owner searches for 24 hours without repeat provider calls
- [x] Show credit costs on every credit-consuming action
- [x] Verify build and key pricing flows

## Communication compliance
- [x] Require one-time TCPA and Do Not Call acknowledgment before first app SMS or call
- [x] Process STOP, UNSUBSCRIBE, and CANCEL replies and block future texts
- [x] Add sender address and unsubscribe link to campaign email footers
- [x] Require recorded lead consent for AI Voice Agent calls and retain Beta labeling
- [x] Publish substantive Privacy and Terms pages from the landing footer
- [x] Verify database rules, functions, and types
- [x] Verify signed-in browser-visible compliance states (blocked: no preview account access)

## Real Estate mobile experience
- [x] Replace the phone sidebar with Home, Find Owners, My Leads, Outreach, and More tabs
- [x] Render Find Owners and My Leads as stacked phone cards while preserving desktop tables
- [x] Add pinned Call, Text, and Email actions to owner details on phones
- [x] Add manifest-only home-screen install support, app icons, splash color, and one-time install tip
- [x] Audit every Real Estate page at 375px for overflow and 44px tap targets
- [x] Verify build health and phone interactions

## Appointment booking
- [x] Booking link + Cal.com connect in Settings, Insert booking link buttons, Cal.com webhook

## Follow-up plans (sequences)
- [x] FSBO 45-day and FRBO 30-day editable plans
- [x] "Start plan" on owner page; steps become follow-ups with AI drafts (claude-ai), never auto-send
- [x] Auto-stop on reply / Appointment set / Listing signed / Lost / Do not contact
- [x] Progress on lead ("Step 3 of 7, next: call on Oct 12")
- [x] Idempotent scheduled job that catches up missed days

## Find Owners listing link
- [x] Show a link to the actual listing on every Find Owners result (list, phone cards, map card, owner page)

## Claude chat
- [x] Confirm whether users have a Claude chat (answer the user)
