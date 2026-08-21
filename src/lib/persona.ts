/**
 * Persona system: role + goals captured at signup, used to scope the workspace
 * navigation to only the tools that persona needs.
 */

export type PersonaRoleId = "realtor" | "sales_rep" | "team_lead" | "founder";

export type PersonaRole = {
  id: PersonaRoleId;
  label: string;
  description: string;
};

export type PersonaGoal = {
  id: string;
  label: string;
  description: string;
  /** Sidebar hrefs unlocked by this goal. */
  tools: string[];
};

/** Always available, regardless of persona. */
export const ALWAYS_VISIBLE_NAV = [
  "/dashboard",
  "/dashboard/leads",
  "/dashboard/billing",
  "/dashboard/settings",
];

export const PERSONA_ROLES: PersonaRole[] = [
  {
    id: "realtor",
    label: "Realtor / Real estate agent",
    description: "FSBO & FRBO owners, skip tracing, listing outreach.",
  },
  {
    id: "sales_rep",
    label: "Sales rep / SDR / AE",
    description: "ICP prospecting, finding the right POC and their contact info.",
  },
  {
    id: "team_lead",
    label: "Team lead / Sales manager",
    description: "Team performance, lead routing, pipeline reporting.",
  },
  {
    id: "founder",
    label: "Founder / Agency / Recruiter",
    description: "Mixed use cases across prospecting and outreach.",
  },
];

export const PERSONA_GOALS: Record<PersonaRoleId, PersonaGoal[]> = {
  realtor: [
    {
      id: "fsbo_frbo",
      label: "Find FSBO / FRBO listings",
      description: "Owner-listed properties for sale or rent by owner.",
      tools: ["/dashboard/scraper", "/dashboard/deals"],
    },
    {
      id: "owner_contact",
      label: "Get owner phone & email (skip trace)",
      description: "Turn a listing into a reachable owner.",
      tools: ["/dashboard/tools", "/dashboard/scraper"],
    },
    {
      id: "listing_outreach",
      label: "Work listings with calls & texts",
      description: "Voice agent, templates and call workflows.",
      tools: ["/dashboard/voice-agent", "/dashboard/templates", "/dashboard/sequences"],
    },
    {
      id: "listing_pipeline",
      label: "Track listings through a pipeline",
      description: "Stages from new owner lead to signed listing.",
      tools: ["/dashboard/pipeline", "/dashboard/reports", "/dashboard/deals"],
    },
  ],
  sales_rep: [
    {
      id: "icp_leads",
      label: "Find companies that fit my ICP",
      description: "Target accounts by industry, size and location.",
      tools: ["/dashboard/scraper", "/dashboard/accounts"],
    },
    {
      id: "find_poc",
      label: "Find the right point of contact",
      description: "Decision-makers by title at a target account.",
      tools: ["/dashboard/scraper", "/dashboard/accounts"],
    },
    {
      id: "poc_contact_info",
      label: "Get their email & phone",
      description: "Enrichment waterfall for verified contact data.",
      tools: ["/dashboard/tools"],
    },
    {
      id: "outbound",
      label: "Run outbound email & sequences",
      description: "Campaigns, sequences and templates.",
      tools: ["/dashboard/sequences", "/dashboard/campaigns", "/dashboard/templates"],
    },
    {
      id: "buying_signals",
      label: "Track buying signals & AI agents",
      description: "Intent signals and AI assistance on accounts.",
      tools: ["/dashboard/signals", "/dashboard/ai-agents"],
    },
    {
      id: "own_pipeline",
      label: "Manage my pipeline",
      description: "Deal stages and forecast.",
      tools: ["/dashboard/pipeline"],
    },
  ],
  team_lead: [
    {
      id: "team_perf",
      label: "Manage my team's performance",
      description: "Seats, assignments and activity.",
      tools: ["/dashboard/team", "/dashboard/advanced-analytics"],
    },
    {
      id: "reporting",
      label: "Report on pipeline & results",
      description: "Pipeline health and custom reports.",
      tools: ["/dashboard/pipeline", "/dashboard/reports", "/dashboard/advanced-analytics"],
    },
    {
      id: "team_sourcing",
      label: "Source leads for the team",
      description: "Prospecting and enrichment for reps.",
      tools: ["/dashboard/scraper", "/dashboard/tools", "/dashboard/accounts"],
    },
    {
      id: "team_outbound",
      label: "Standardize outbound messaging",
      description: "Shared sequences, campaigns and templates.",
      tools: ["/dashboard/sequences", "/dashboard/campaigns", "/dashboard/templates"],
    },
  ],
  founder: [
    {
      id: "founder_sourcing",
      label: "Find leads that fit my ICP",
      description: "Companies, people and local businesses.",
      tools: ["/dashboard/scraper", "/dashboard/accounts"],
    },
    {
      id: "founder_contact",
      label: "Get verified contact info",
      description: "Email and phone enrichment.",
      tools: ["/dashboard/tools"],
    },
    {
      id: "founder_outbound",
      label: "Run outreach end to end",
      description: "Sequences, campaigns, templates and voice.",
      tools: [
        "/dashboard/sequences",
        "/dashboard/campaigns",
        "/dashboard/templates",
        "/dashboard/voice-agent",
      ],
    },
    {
      id: "founder_ops",
      label: "Track pipeline & analytics",
      description: "Pipeline, reports and AI agents.",
      tools: [
        "/dashboard/pipeline",
        "/dashboard/reports",
        "/dashboard/advanced-analytics",
        "/dashboard/ai-agents",
      ],
    },
  ],
};

export function getRole(roleId?: string | null): PersonaRole | undefined {
  return PERSONA_ROLES.find((r) => r.id === roleId);
}

export function getGoalsForRole(roleId?: string | null): PersonaGoal[] {
  if (!roleId) return [];
  return PERSONA_GOALS[roleId as PersonaRoleId] ?? [];
}

/**
 * Hrefs the sidebar should show. Returns null when the persona is unknown,
 * meaning "show everything".
 */
export function allowedNavHrefs(
  roleId?: string | null,
  goalIds?: string[] | null,
): Set<string> | null {
  const goals = getGoalsForRole(roleId);
  if (!roleId || goals.length === 0) return null;
  const selected = goals.filter((g) => (goalIds ?? []).includes(g.id));
  const active = selected.length > 0 ? selected : goals;
  const allowed = new Set(ALWAYS_VISIBLE_NAV);
  // Realtors get the Deals workspace in place of Accounts.
  if (roleId === "realtor") allowed.add("/dashboard/deals");
  for (const goal of active) goal.tools.forEach((t) => allowed.add(t));
  return allowed;
}
