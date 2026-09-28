# Real Estate workspace and admin security

## What will change
- Give Real Estate users a five-item sidebar in this exact order: Home, Find Owners, My Leads, Outreach, Settings & Billing.
- Combine Campaigns, Sequences, and Templates behind one Outreach page with tabs; hide Marketing for this role.
- Keep the existing lead board as a List/Pipeline toggle inside My Leads and remove the separate Pipeline link for this role.
- Add an admin-only route gate so direct links to every admin page are rejected for non-admin users.
- Tighten database access for the tables powering admin screens so non-admin sessions cannot read or change their data.
- Verify the Real Estate navigation, Outreach tabs, My Leads pipeline toggle, direct admin-route denial, and build health.

## Technical details
- Reuse the existing role identifier and lead board; no role behavior or lead data model changes.
- Preserve current routes for other personas while adding a consolidated Outreach route for Real Estate.
- Use the server-validated admin role check and `has_role(auth.uid(), 'admin')` database policies for privileged surfaces.
