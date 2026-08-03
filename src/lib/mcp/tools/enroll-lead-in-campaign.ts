import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "enroll_lead_in_campaign",
  title: "Enroll lead in campaign",
  description:
    "Enroll one of the signed-in user's Brivano leads into an email campaign so it starts receiving the sequence.",
  inputSchema: {
    lead_id: z.string().trim().min(1).describe("The lead's UUID."),
    campaign_id: z.string().trim().min(1).describe("The campaign's UUID."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ lead_id, campaign_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data: existing, error: existingError } = await supabase
      .from("lead_campaign_enrollments")
      .select("id, status")
      .eq("lead_id", lead_id)
      .eq("campaign_id", campaign_id)
      .maybeSingle();
    if (existingError) throw new ToolError(existingError.message);
    if (existing) {
      return {
        content: [
          { type: "text", text: `Lead is already enrolled (status: ${existing.status}).` },
        ],
        structuredContent: { enrollment: existing, already_enrolled: true },
      };
    }

    const { data, error } = await supabase
      .from("lead_campaign_enrollments")
      .insert({ lead_id, campaign_id, status: "active", current_step: 0 })
      .select("id, lead_id, campaign_id, status, current_step, enrolled_at")
      .single();
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { enrollment: data, already_enrolled: false },
    };
  },
});
