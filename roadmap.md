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
- [ ] Verify signed-in Real Estate navigation and non-admin route denial (blocked: no matching preview account)

## New-user Home dashboard
- [x] Replace KPI cards with an automatic Get started checklist below five saved leads
- [x] Remove fabricated trend badges
- [x] Gate advanced AI and hourly performance widgets until 14 days of activity
- [x] Show remaining credits with a Billing link
- [x] Verify type safety and build health
- [ ] Verify signed-in new-user and established-user states (blocked: no matching preview account)

## Data consistency
- [x] Use one shared leads query for Home, My Leads, and Reports totals
- [x] Prevent empty-state flashes and replace Voice Agent loading text with skeletons
- [x] Remove subscription management from Settings
- [ ] Verify affected signed-in pages in the browser (blocked: preview account access required)

## Credit pricing and fair use
- [ ] Centralize plan allowances, action costs, AI message limits, and add-on pricing in database settings
- [ ] Update landing pricing and Billing plan displays with real-estate descriptions and credit explanations
- [ ] Charge city searches, successful owner contact lookups, SMS, and voice minutes from centralized costs
- [ ] Keep AI messages credit-free while enforcing monthly per-seat fair-use limits
- [ ] Show AI message monthly usage in Billing and clear limit messaging
- [ ] Add 500-credit / $25 add-on purchase option
- [ ] Cache city owner searches for 24 hours without repeat provider calls
- [ ] Show credit costs on every credit-consuming action
- [ ] Verify build and key pricing flows
