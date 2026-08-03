import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { LEAD_FIELDS } from "./search-leads";

export default defineTool({
  name: "get_account_leads",
  title: "Get account leads",
  description:
    "List every Brivano lead associated with a company / account name, so you can see all contacts at that company.",
  inputSchema: {
    company_name: z
      .string()
      .trim()
      .min(1)
      .describe("Company / account name (partial match is allowed)."),
    limit: z.number().int().optional().describe("Max rows to return (default 50, max 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_name, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    const escaped = company_name.replace(/[%,()]/g, " ").trim();

    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_FIELDS)
      .ilike("business_name", `%${escaped}%`)
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(take);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { company_name, count: data?.length ?? 0, leads: data ?? [] },
    };
  },
});
