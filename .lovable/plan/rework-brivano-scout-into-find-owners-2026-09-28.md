# Rework Brivano Scout into Find Owners

## Experience
- Add **Find Owners** directly beneath Home for Real Estate users, linking to the existing Real Estate search.
- Retitle the page and replace the subtitle with the requested homeowner-focused wording.
- Simplify the search form to City/State, Selling/Renting/Both, result count, and Best matches/All results.
- Place Market and Scan depth in a collapsed Advanced options section.
- Rename action buttons, filter labels, table columns, match labels, and the empty state exactly as requested.
- Remove vendor names and internal classifier/operations language from all customer-visible parts of this screen.

## Credits
- Read the contact-information cost from the existing active credit settings.
- Show selected count and calculated cost on credit-consuming actions.
- Preserve the existing search, enrichment, and save behavior.

## Reliability
- Replace technical failures with: “We couldn't load your results. Please try again in a minute.”
- Keep detailed errors in logs for administrators.
- Repair My past searches by avoiding the unreachable external server for saved rows and reading the signed-in user’s saved listings from Lovable Cloud when possible.

## Verification
- Check the Real Estate role’s sidebar ordering and route behavior.
- Test the form, empty state, table, saved searches, and safe error handling.
- Confirm the app builds without errors.
