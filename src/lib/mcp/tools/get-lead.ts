import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { LEAD_FIELDS } from "./search-leads";

export default defineTool({
  name: "get_lead",
  title: "Get lead",
  description:
    "Fetch one Brivano lead by id, including its full contact details, score, status and notes.",
  inputSchema: {
    lead_id: z.string().trim().min(1).describe("The lead's UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_FIELDS)
      .eq("id", lead_id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError(`No lead found with id ${lead_id}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { lead: data },
    };
  },
});
