import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fillTokens, textOptOutLine, voicemailTips } from "@/data/playbookContent";
import { useProspectingProfile } from "@/hooks/useProspectingProfile";
import { isRoleMatch, scriptsFor, textsFor, toLeadType, tokenValues, voicemailsFor, type TokenLead } from "@/lib/playbook";
import { ScriptCard } from "./ScriptCard";
import { CopyText } from "./CopyText";
import { LogContactButton } from "@/components/leads/LogContactButton";

type Props = {
  lead: TokenLead & { id?: string | null; listing_type?: string | null; do_not_contact?: boolean | null };
  /** Used when the lead has no saved listing type (e.g. an unsaved Find Owners result). */
  fallbackType?: "fsbo" | "frbo";
  className?: string;
};

export function CallScriptDialog({ lead, fallbackType, className }: Props) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { profile } = useProspectingProfile();
  const role = profile?.prospecting_role ?? null;
  const type = toLeadType(lead.listing_type ?? fallbackType ?? null);
  const scripts = useMemo(() => scriptsFor(type, role, showAll), [type, role, showAll]);
  const v = useMemo(() => tokenValues(lead, profile), [lead, profile]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className ?? "min-h-11 gap-1.5 text-xs md:min-h-8"} onClick={() => setOpen(true)}>
        <ScrollText className="h-3.5 w-3.5" /> Call script
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[100dvh] w-full max-w-2xl overflow-y-auto max-sm:h-[100dvh] max-sm:rounded-none">
          <DialogHeader>
            <DialogTitle>Call script{type ? ` · ${type}` : ""}</DialogTitle>
            <DialogDescription>
              {role ? "Scripts for your role, filled in with this owner's details." : (
                <>Set your role in the <Link to="/dashboard/playbook" className="underline">Playbook</Link> to see the best match first.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {lead.do_not_contact && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">This owner asked not to be contacted. Don't call or text.</p>}
          {role && (
            <label className="flex min-h-11 items-center justify-between text-sm"><span>Show all scripts</span><Switch checked={showAll} onCheckedChange={setShowAll} /></label>
          )}
          <Accordion type="single" collapsible defaultValue={scripts[0]?.id} className="space-y-2">
            {scripts.map((s) => (
              <AccordionItem key={s.id} value={s.id} className="rounded-md border px-3">
                <AccordionTrigger className="min-h-11 text-left text-sm">{s.title}</AccordionTrigger>
                <AccordionContent><ScriptCard script={s} values={v} recommended={isRoleMatch(s, role)} /></AccordionContent>
              </AccordionItem>
            ))}
            <AccordionItem value="voicemail" className="rounded-md border px-3">
              <AccordionTrigger className="min-h-11 text-sm">Voicemail</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{voicemailTips}</p>
                {voicemailsFor(type).map((m) => <CopyText key={m.type} label={`${m.type} voicemail`} text={fillTokens(m.text, v)} />)}
              </AccordionContent>
            </AccordionItem>
            {!lead.do_not_contact && (
              <AccordionItem value="texts" className="rounded-md border px-3">
                <AccordionTrigger className="min-h-11 text-sm">Texts</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {textsFor(type).map((t) => <CopyText key={t.id} label={t.label} text={`${fillTokens(t.text, v)} ${textOptOutLine}`} />)}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
          <div className="flex flex-wrap gap-2 pt-2">
            {lead.id && !lead.do_not_contact && <LogContactButton leadId={lead.id} label="Log outcome" onLogged={() => setOpen(false)} />}
            <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1.5 text-xs md:min-h-8"><Link to="/dashboard/playbook"><BookOpen className="h-3.5 w-3.5" />Full Playbook</Link></Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
