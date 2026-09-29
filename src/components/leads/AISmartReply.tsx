import { AIWriter } from "./AIWriter";

interface AISmartReplyProps {
  lead: { id?: string };
}

export const AISmartReply = ({ lead }: AISmartReplyProps) =>
  lead.id ? <AIWriter leadId={lead.id} title="AI reply suggestion" tasks={["reply_suggestion"]} /> : null;
