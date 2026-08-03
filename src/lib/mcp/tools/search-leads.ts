import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const LEAD_FIELDS =
  "id, business_name, contact_name, email, phone, website, linkedin_url, industry, city, state, zip_code, company_size, estimated_revenue, lead_score, status, source_url, notes, created_at, updated_at";

export default defineTool({
  name: "search_leads",
  title: "Search leads",
  description:
    "Search the signed-in user's Brivano leads by free text, status, industry, city or state. Returns contact details, company, score and status.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .optional()
      .describe("Free text matched against company name, contact name and email."),
    status: z
      .string()
      .trim()
      .optional()
      .describe("Lead status filter, e.g. new, contacted, qualified, converted."),
    industry: z.string().trim().optional().describe("Industry filter (partial match)."),
    city: z.string().trim().optional().describe("City filter (partial match)."),
    state: z.string().trim().optional().describe("State filter (partial match)."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, status, industry, city, state, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 25, 1), 100);

    let request = supabase
      .from("leads")
      .select(LEAD_FIELDS)
      .order("created_at", { ascending: false })
      .limit(take);

    if (query) {
      const escaped = query.replace(/[%,()]/g, " ").trim();
      if (escaped) {
        request = request.or(
          `business_name.ilike.%${escaped}%,contact_name.ilike.%${escaped}%,email.ilike.%${escaped}%`,
        );
      }
    }
    if (status) request = request.eq("status", status);
    if (industry) request = request.ilike("industry", `%${industry}%`);
    if (city) request = request.ilike("city", `%${city}%`);
    if (state) request = request.ilike("state", `%${state}%`);

    const { data, error } = await request;
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, leads: data ?? [] },
    };
  },
});
