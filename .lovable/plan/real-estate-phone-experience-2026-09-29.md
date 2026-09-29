# Real Estate phone experience

## Goal
Make the signed-in Real Estate workspace comfortable at 375px wide without changing the existing desktop experience.

## What will change

### Phone navigation
- Hide the left sidebar for Real Estate users on phone widths.
- Add a fixed bottom tab bar with Home, Find Owners, My Leads, Outreach, and More.
- Make each tab at least 44px tall, indicate the current section, and respect iPhone safe-area spacing.
- Open More as a compact menu for My Results, Settings, Billing, theme, and sign out.
- Add bottom spacing to every signed-in Real Estate page so content and floating controls never sit behind the tab bar.

### Find Owners and My Leads
- Keep the existing desktop tables unchanged at larger widths.
- At phone widths, render each Find Owners result as a tappable stacked card showing address, Selling/Renting, price, and current owner flags/badges, with a 44px selection control.
- Render each My Leads result as a stacked card using the address, listing type when available, price when available, and status/flag badges.
- Reflow search, filters, selection actions, view toggles, and pagination into full-width or wrapping phone controls without horizontal scrolling.

### Owner detail actions
- Add a phone-only fixed action bar above the main tab bar with large Call, Text, and Email actions.
- Use native `tel:`, `sms:`, and `mailto:` links so Call and Text open the phone apps.
- Disable unavailable actions clearly when contact information is missing, while preserving the existing Get contact info flow.
- Add enough page-bottom spacing so the fixed actions never cover owner content.

### Home-screen installation
- Add a standards-based web app manifest with Brivano name, standalone display mode, theme/background colors, and dedicated app icons.
- Add matching manifest, theme-color, Apple touch icon, and favicon metadata.
- Show a dismissible one-time “Add Brivano to your home screen” tip on phones, using the browser install prompt when available and concise platform guidance otherwise.
- Keep this manifest-only: no offline cache or service worker will be added.

### Phone-wide quality pass
- Check the Real Estate Home, Find Owners, My Leads/Pipeline, owner details, Outreach tabs, My Results, Settings, and Billing at 375px.
- Fix clipped tabs, charts, forms, dialogs, menus, and action rows that cause page-level sideways scrolling.
- Raise phone tap targets to at least 44px while keeping the current dense desktop sizing.
- Verify the signed-out shell where authentication prevents direct inspection, then validate signed-in views through source-level checks and any available managed test session.

## Technical details
- Centralize the Real Estate mobile tab bar, More sheet, safe-area offsets, and install tip in the authenticated layout.
- Add shared mobile owner/lead card renderers rather than duplicating table behavior.
- Reuse existing semantic colors, buttons, badges, routes, persona checks, and contact data.
- Use manifest-only installability per the PWA rules; installation behavior will be available on the published secure site, with browser-specific prompt behavior.
- Record the mobile navigation and manifest-only decisions in the project architecture notes.
