import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_campaigns",
  title: "List campaigns",
  description:
    "List the signed-in user's Brivano email campaigns with their id, name, description and active state.",
  inputSchema: {
    active_only: z
      .boolean()
      .optional()
      .describe("When true, return only campaigns that are currently active."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ active_only }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    let request = supabase
      .from("email_campaigns")
      .select("id, name, description, is_active, created_at")
      .order("created_at", { ascending: false });
    if (active_only) request = request.eq("is_active", true);

    const { data, error } = await request;
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, campaigns: data ?? [] },
    };
  },
});
