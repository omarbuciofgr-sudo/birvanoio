import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchLeadsTool from "./tools/search-leads";
import getLeadTool from "./tools/get-lead";
import createLeadTool from "./tools/create-lead";
import updateLeadTool from "./tools/update-lead";
import listCampaignsTool from "./tools/list-campaigns";
import enrollLeadInCampaignTool from "./tools/enroll-lead-in-campaign";
import getAccountLeadsTool from "./tools/get-account-leads";

// Issuer must be the direct Supabase host, built from the project ref (inlined at build time).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "brivano-leads",
  title: "Brivano Leads",
  version: "0.1.0",
  instructions:
    "Tools for Brivano, a B2B lead generation and CRM workspace. Use `search_leads` and `get_account_leads` to find leads, `get_lead` for full detail, `create_lead` and `update_lead` to manage records, and `list_campaigns` + `enroll_lead_in_campaign` to run outreach. All tools act as the signed-in Brivano user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchLeadsTool,
    getAccountLeadsTool,
    getLeadTool,
    createLeadTool,
    updateLeadTool,
    listCampaignsTool,
    enrollLeadInCampaignTool,
  ],
});
