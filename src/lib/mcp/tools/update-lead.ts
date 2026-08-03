import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { LEAD_FIELDS } from "./search-leads";

export default defineTool({
  name: "update_lead",
  title: "Update lead",
  description:
    "Update an existing Brivano lead: change its status, score, notes or contact details. Only the provided fields are changed.",
  inputSchema: {
    lead_id: z.string().trim().min(1).describe("The lead's UUID."),
    status: z
      .string()
      .trim()
      .optional()
      .describe("New status, e.g. new, contacted, qualified, converted, rejected."),
    contact_name: z.string().trim().optional(),
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    website: z.string().trim().optional(),
    linkedin_url: z.string().trim().optional(),
    industry: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    lead_score: z.number().optional().describe("Lead score between 0 and 100."),
    notes: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ lead_id, ...updates }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");

    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(payload).length === 0) {
      throw new ToolError("Provide at least one field to update");
    }

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", lead_id)
      .select(LEAD_FIELDS)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError(`No lead found with id ${lead_id}`);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { lead: data },
    };
  },
});
