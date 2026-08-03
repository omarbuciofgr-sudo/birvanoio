import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { LEAD_FIELDS } from "./search-leads";

export default defineTool({
  name: "create_lead",
  title: "Create lead",
  description:
    "Create a new lead in Brivano for the signed-in user. Company (business) name is required; every other field is optional.",
  inputSchema: {
    business_name: z.string().trim().min(1).describe("Company / account name."),
    contact_name: z.string().trim().optional().describe("Full name of the person."),
    email: z.string().trim().optional().describe("Contact email address."),
    phone: z.string().trim().optional().describe("Contact phone number."),
    website: z.string().trim().optional().describe("Company website URL."),
    linkedin_url: z.string().trim().optional().describe("LinkedIn profile URL."),
    industry: z.string().trim().optional().describe("Industry of the company."),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    notes: z.string().trim().optional().describe("Free-form notes about the lead."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Could not resolve the signed-in user");

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leads")
      .insert({ ...input, client_id: userId })
      .select(LEAD_FIELDS)
      .single();
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { lead: data },
    };
  },
});
