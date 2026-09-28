# Centralize pricing, credits, and AI fair use

## Outcome
Pricing, Billing, and every paid action will use one authoritative set of database-managed rules. Users will see costs before acting, successful actions will be charged consistently, AI messages will remain credit-free within monthly limits, and recent city searches will reuse saved results for 24 hours.

## Pricing and plan presentation
- Update monthly credits per seat: Free 50, Starter 1,000, Growth 2,500, Scale 7,500.
- Keep paid prices at Starter $49, Growth $99, and Scale $249.
- Use the requested real-estate plan descriptions.
- Show approximate owner lookups from the 10-credit lookup cost: about 5, 100, 250, and 750 per seat monthly.
- List AI-written messages included per seat: 20, 300, 1,000, and 3,000 monthly.
- Replace the unlimited communications claim with “Calls, email & SMS included (standard carrier limits apply).”
- Add “What does a credit get me?” to both Pricing and Billing using the live settings: city search 1, successful owner contact 10, SMS 1, voice 10/minute, email free.
- Add a 500-credit add-on for $25 and expose its purchase action from Billing.

## Central rules and safe charging
- Add an authenticated-readable pricing settings table for plan allowances, action costs, AI message limits, and add-on details; only service code and admins may change it.
- Add server-side functions for atomic balance checks and usage recording so users cannot bypass costs from the browser.
- Charge city searches once when a new provider search begins.
- Charge owner contact lookup only when a phone number or email is returned; no match remains free.
- Charge SMS only after the provider accepts the message.
- Charge voice calls from recorded duration at 10 credits per started minute.
- Keep email free.
- Update existing credit displays and guards to consume these settings instead of hardcoded values.

## AI message fair-use limits
- Record successful AI message generations per user and billing month.
- Enforce per-seat monthly limits on the server before calling the AI provider.
- Cover current AI message generation entry points, including single messages and generated sequences.
- Show “AI messages: X of Y used this month” in Billing.
- When exhausted, show: “You've reached this month's AI message limit. Upgrade for more.”

## Search caching
- Reuse user-scoped saved Find Owners results for matching city/search criteria when they are less than 24 hours old.
- Do not call the external listing provider or charge another city-search credit for a valid cached result.
- Preserve force refresh as an explicit fresh provider call with its displayed credit cost.

## Interface updates
- Show the live credit cost in every button label or adjacent action label that spends credits, including bulk actions with calculated totals.
- Refresh balances and usage immediately after successful actions.
- Preserve loading, insufficient-credit, no-match, provider-error, and fair-use-limit states.

## Technical details
- Apply schema and security changes through a migration with explicit grants and row-level access rules.
- Add a shared pricing hook/module backed by cached database settings with safe defaults.
- Extend payment handling for the one-time add-on pack and apply purchased credits after confirmed payment.
- Add focused tests for atomic charging, no-match behavior, fair-use limits, cache freshness, and add-on fulfillment.
- Verify type safety, build health, and key desktop/mobile flows.
