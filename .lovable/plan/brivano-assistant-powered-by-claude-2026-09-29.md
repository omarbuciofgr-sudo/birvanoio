# Brivano Assistant (powered by Claude)

## What users get
- "Ask Brivano Assistant" button in the top bar and on Home. Side panel on computers, full screen on phones. Header: "Brivano Assistant · powered by Claude".
- Past chats list, New chat, streaming replies, and 4 suggested starters on an empty chat.
- Replaces the current corner chat bubble, so there's only one assistant.
- The assistant looks things up on its own. It shows a Confirm / Cancel card with the exact credit cost before anything that changes data or uses credits.
- Drafts appear in an editable box with Copy and Send. Only the user can send. Owners marked Do Not Contact are blocked.
- New "Automations" page (under More / Settings area): list, pause, edit, delete. Each has a schedule, time zone, instructions, a credit cap per run and an on/off switch.

## Tools
- Read-only (run without asking): search my leads, get lead, today's follow-ups, my stats, credit balance, saved searches.
- Need Confirm: find owners, get contact info, save to My Leads, set follow-up, change lead status, start follow-up plan, create daily alert, create automation.
- Drafting: text, email or call script in Friendly / Direct / Brief. Uses the same Claude writer as the Scripts tab, and never includes owner phone or email.

## Limits
- Each assistant reply counts toward the same monthly AI allowance per seat (Free 20, Starter 300, Growth 1,000, Scale 3,000), already shown in Billing.
- Only the last 20 messages are sent to Claude. Each call is logged with its tools and tokens.
- Only friendly error messages are shown.

## Automations
- A job runs every 15 minutes and picks up automations that are due in the owner's time zone.
- Each run uses only the allowed tools (search, save, follow-ups, drafts) and never sends messages. It stops before going over the run's credit cap.
- A run key per automation per scheduled time prevents duplicate runs.
- The result summary is saved as a chat in history and added to the morning email.

## Technical details
- Tables: `assistant_threads`, `assistant_messages` (Claude content blocks as jsonb), `assistant_pending_actions` (tool, args, cost, status, expires), `automations`, `automation_runs` (unique automation_id + scheduled_for). Owner-scoped RLS and GRANTs on all of them.
- `assistant-chat` edge function: Anthropic Messages API with tool use, model from `ai_settings.claude_model`, server-side tool loop (max 8 rounds), and a user-token client, so the app's own security rules apply.
  - Action tools don't run. They create a pending action and end the turn with a confirmation card.
  - `assistant-confirm` runs the confirmed action through the existing logic: `consume-credits`, the RentCast search path, lead insert, `lead_follow_ups`, `startPlan` equivalents, `saved_searches`. Then it resumes the loop.
- Prompt injection: listing and owner text is wrapped as quoted data, following the brief's system prompt.
- `assistant-automations` cron: service-role picks due rows, then runs the loop with an automation-scoped tool allowlist and credit cap, running tools as that user via a scoped client.
- Retire the `ai-dashboard-chat` bubble after the new panel ships.

## Decisions for you
- Automations run with pre-approved actions (the confirmation is given once when the automation is created) and stay inside its credit cap.
