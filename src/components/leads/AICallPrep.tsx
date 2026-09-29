import { AIWriter } from "./AIWriter";

interface AICallPrepProps {
  lead: { id: string };
}

export const AICallPrep = ({ lead }: AICallPrepProps) => (
  <AIWriter
    leadId={lead.id}
    title="Call prep"
    tasks={["call_script", "talking_points", "lead_summary", "market_report_summary"]}
  />
);
