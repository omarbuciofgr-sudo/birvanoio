# New-user Home dashboard

## What will change
- Replace stat cards with a four-step Get started checklist while the user has fewer than five saved leads.
- Complete checklist steps automatically from real records: owner searches, contact-info actions, saved leads, and sent messages.
- Remove all hard-coded trend badges; future trends appear only when a real previous-period comparison exists.
- Hide forecasting, churn, daily priorities, and hourly call/email charts until the account has at least 14 days of recorded activity.
- Show remaining credits on Home with a direct Billing link.
- Verify new-user and established-user rendering, checklist links, activity gating, and build health.

## Technical details
- Derive onboarding progress from user-scoped tables already protected by existing access rules.
- Define activity age from the earliest accessible lead, owner search, message, or call record.
- Keep the existing customizable layout, but apply product eligibility rules after user preferences so hidden early-stage widgets cannot be forced visible.
