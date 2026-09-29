import { AIWriter } from "./AIWriter";

interface AIOutreachPanelProps {
  lead: { id: string };
}

export const AIOutreachPanel = ({ lead }: AIOutreachPanelProps) => (
  <AIWriter leadId={lead.id} title="AI first message" tasks={["text_message", "email"]} />
);
