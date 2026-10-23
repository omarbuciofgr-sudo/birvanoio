# Prospecting Playbook for Real Estate

## What already exists and how it gets reused

| Existing piece | Today | Plan |
|---|---|---|
| Starter scripts (`scriptTemplates.ts`, Outreach > Templates > Scripts library) | 6 short FSBO/FRBO call/text/email templates using `{{owner_name}}`-style tokens; users can save copies | Keep. The Playbook becomes the full guide. Its text templates also show up in the Scripts library, so there's one place to save your own versions |
| Claude scripts (owner page Scripts tab, `claude-ai`) | AI-written call/text/email drafts with tone choices | Keep as "Write with AI". The new "Call script" button shows the fixed Playbook scripts with tokens filled in. It sits next to Write with AI and doesn't replace it |
| Onboarding (`PersonaSetupDialog`) | Steps: role (Real Estate) → goals → home market. Signup already asks for company name and phone (`profiles.company_name`, `phone`) | Add one step for Real Estate: "How do you prospect?" Only ask for company and phone if they're blank. Existing users get asked once, as a small prompt on the Playbook |
| Onboarding tour (`OnboardingTour`) | Guided tour of the product | Add one tour step pointing to Playbook. No new tour |
| Roles (`profiles.persona_role`) | Only the broad role, e.g. `realtor` | Add a separate prospecting role. The nav and permission logic stay as they are |
| Call logging (`conversation_logs`, `LogContactButton`, daily goals) | Logs calls, texts and emails, plus outside contacts with a note. Counts toward goals and moves New to Contacted | Turn "Log contact" into "Log call" with an outcome choice and a follow-up date. It writes to the same table, so goals and the New→Contacted move keep working |
| Follow-ups (`lead_follow_ups`, `SetFollowUp`, Today's follow-ups, plans) | Quick dates, notes, Home list, morning email | The follow-up date from logging an outcome becomes a regular follow-up, so it shows up on Home and in the morning email automatically |
| Do not contact (`leads.do_not_contact`, STOP handling, plans stop on DNC) | Server-side text blocking and automatic plan stopping | The "Do not call" outcome sets the same flag. Call and Text buttons are hidden everywhere for that lead, and the existing server checks still block sending |
| Lead stages | New → Contacted → Appointment set → Listing signed → Lost | The "Appointment set" outcome moves the lead to that stage. "Not interested" leaves the stage alone unless you choose Lost |

## Lead fields today (confirmed in the database)
- Owner name: `contact_name`
- Address: `business_name` (holds the street address for real estate leads). There's no separate street field.
- City/State/Zip: `city`, `state`, `zip_code`
- FSBO/FRBO type: **no field exists.** Today it's guessed from words like "rent" or "frbo" in `notes`. This is unreliable, so a real field gets added.

Token mapping: `{ownerName}` from contact_name, shown as "there" if blank. `{street}` from business_name. `{area}` from city, or your home market. `{yourName}` from your first and last name. `{company}` from brokerage, or company_name. `{phone}` from your phone number.

## Database changes
1. `leads.listing_type` text, nullable, either `fsbo` or `frbo`. It's filled for existing leads from notes and source, and new leads saved from Find Owners get it set. Leads with no type show both script types.
2. `profiles.prospecting_role` text, nullable, one of `agent`, `investor`, `leasing_agent` or `property_manager`.
3. `conversation_logs.outcome` text, nullable, one of `no_answer`, `voicemail`, `conversation`, `not_interested`, `appointment_set` or `do_not_call`. Only new columns are added, and existing permission rules already cover them.
4. Playbook content lives in a file in the app, not the database, since it's the same for everyone.

## Build steps
1. **Content**: bring in your data file as a typed Playbook file (sections, scripts with goal, opener, discovery questions, bridge, asks, objections, notes, plus voicemails, cadence and texts). Add one shared token-filling helper.
2. **Database**: the three columns above, plus filling in listing types for existing leads. Update saving from Find Owners and the Assistant so new leads get a listing type.
3. **Playbook page** at `/dashboard/playbook`: shown to every user, in the sidebar for all workspaces and under More on phones. Sections are collapsible, with a jump menu at the top. Scripts for your role show first, with a "Show all scripts" switch. Copy buttons on openers, asks, voicemails and texts. Checked at 375px wide with 44px buttons.
4. **Onboarding**: add the prospecting role step for Real Estate, with company and phone only if missing. Existing users see a one-time prompt on the Playbook. The role can be changed in Settings > Profile.
5. **Call script button** on the owner page and lead cards: opens a panel (full screen on phones) with scripts matching the lead's type and your role. Tokens are filled in, with copy buttons, plus a link to the full Playbook and a "Log outcome" button.
6. **Call outcome logging**: replace Log contact with an outcome picker, a quick follow-up date (based on the cadence) and a note. Do not call sets the DNC flag and stops plans. Appointment set moves the stage. Show the outcome on the activity timeline.
7. **Hide Call/Text for do-not-contact leads** everywhere: owner page bottom bar, lead cards, Today's follow-ups and the Assistant drafts. Show a "Do not contact" badge instead.
8. **Tests and checks**: tests for token filling, matching scripts to role and lead type, and outcome rules (DNC hides actions, Appointment set moves the stage). Then a signed-in check on a phone-sized screen.

## Decisions
- Investors and wholesalers see the FSBO investor and FRBO investor scripts. Leasing agents see FRBO tenant placement. Property managers see the FRBO property management script. Agents see FSBO listing and FRBO list-for-sale.
- Every logged outcome, including No answer, counts toward the daily "contacted" goal.
- Building starts only after your content file arrives.
