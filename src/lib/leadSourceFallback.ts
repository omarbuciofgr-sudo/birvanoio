import type { Database } from "@/integrations/supabase/types";

export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

/** Map Scout `scraped_leads.status` into CRM `lead_status` for dashboards / reports when CRM `leads` is empty. */
export function scrapedStatusToLeadStatus(scraped: string): LeadStatus {
  switch (scraped) {
    case "won":
      return "converted";
    case "approved":
    case "assigned":
      return "qualified";
    case "in_progress":
      return "contacted";
    case "lost":
    case "rejected":
      return "lost";
    case "new":
    case "review":
    default:
      return "new";
  }
}

type ScrapedRow = Pick<
  Database["public"]["Tables"]["scraped_leads"]["Row"],
  "id" | "created_at" | "status" | "full_name" | "domain" | "best_email"
>;

/** Build synthetic CRM-shaped rows so Reports charts work from Scout data. */
export function scrapedRowsToSyntheticLeads(rows: ScrapedRow[], clientId: string): LeadRow[] {
  return rows.map((r) => ({
    id: r.id,
    client_id: clientId,
    business_name: (r.full_name || r.domain || "Scout lead").slice(0, 500),
    city: null,
    company_size: null,
    contact_name: r.full_name,
    contacted_at: null,
    converted_at: null,
    created_at: r.created_at,
    email: r.best_email,
    estimated_revenue: null,
    industry: null,
    lead_score: null,
    linkedin_url: null,
    notes: null,
    phone: null,
    social_profiles: null,
    source_url: null,
    state: null,
    status: scrapedStatusToLeadStatus(r.status),
    updated_at: r.created_at,
    website: r.domain,
    zip_code: null,
  }));
}
