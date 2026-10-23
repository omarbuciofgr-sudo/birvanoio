import { useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  compliance, followUpCadence, gettingStarted, textOptOutLine, textTemplates, universalObjections, voicemailTips, voicemails,
} from "@/data/playbookContent";
import { useProspectingProfile } from "@/hooks/useProspectingProfile";
import { isRoleMatch, scriptsFor, tokenValues } from "@/lib/playbook";
import { ScriptCard, ObjectionList } from "@/components/playbook/ScriptCard";
import { CopyText } from "@/components/playbook/CopyText";
import { RoleSetupCard } from "@/components/playbook/RoleSetupCard";
import { fillTokens } from "@/data/playbookContent";
import { CallFlow } from "@/components/playbook/CallFlow";

const SECTIONS = [
  { id: "start", label: "Getting started" },
  { id: "before", label: "Before you dial" },
  { id: "scripts", label: "Call scripts" },
  { id: "objections", label: "Objections" },
  { id: "voicemail", label: "Voicemails" },
  { id: "followup", label: "Follow-up & texts" },
];

export default function Playbook() {
  const { profile, loading, save } = useProspectingProfile();
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string[]>(["start"]);
  const role = profile?.prospecting_role ?? null;
  const scripts = useMemo(() => scriptsFor(null, role, showAll), [role, showAll]);
  // Only the user's own details are filled here; owner details stay as tokens.
  const v = useMemo(() => {
    const t = tokenValues(null, profile);
    return { yourName: t.yourName, company: t.company, phone: t.phone };
  }, [profile]);

  const jump = (id: string) => {
    setOpen((o) => (o.includes(id) ? o : [...o, id]));
    setTimeout(() => document.getElementById(`pb-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-5 pb-24">
        <div>
          <h1 className="text-2xl font-semibold">Prospecting Playbook</h1>
          <p className="text-sm text-muted-foreground">How to call and follow up with owners selling or renting on their own.</p>
        </div>

        {loading ? <Skeleton className="h-24 w-full" /> : <RoleSetupCard profile={profile} save={save} />}

        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Playbook sections">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)} className="min-h-11 shrink-0 rounded-full border border-border px-3 text-sm hover:bg-muted md:min-h-9">
              {s.label}
            </button>
          ))}
        </nav>

        <Accordion type="multiple" value={open} onValueChange={setOpen} className="space-y-3">
          <AccordionItem value="start" id="pb-start" className="rounded-lg border px-4">
            <AccordionTrigger className="min-h-11">Getting started</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p className="text-sm">{gettingStarted.intro}</p>
              <div><p className="mb-1.5 text-sm font-medium">Mindset</p><ul className="list-disc space-y-1 pl-5 text-sm">{gettingStarted.mindset.map((m) => <li key={m}>{m}</li>)}</ul></div>
              <div><p className="mb-1.5 text-sm font-medium">Daily calling rhythm</p><ol className="list-decimal space-y-1 pl-5 text-sm">{gettingStarted.dailyRhythm.map((m) => <li key={m}>{m}</li>)}</ol></div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="before" id="pb-before" className="rounded-lg border px-4">
            <AccordionTrigger className="min-h-11">Before you dial</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{compliance.disclaimer}</p>
              <div className="space-y-2">{compliance.rules.map((r) => <div key={r.title} className="text-sm"><p className="font-medium">{r.title}</p><p className="text-muted-foreground">{r.text}</p></div>)}</div>
              <div><p className="mb-1.5 text-sm font-medium">Prep checklist</p><ul className="list-disc space-y-1 pl-5 text-sm">{compliance.prepChecklist.map((c) => <li key={c}>{c}</li>)}</ul></div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="scripts" id="pb-scripts" className="rounded-lg border px-4">
            <AccordionTrigger className="min-h-11">Call scripts</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="rounded-md border border-border p-3">
                <h2 className="mb-3 text-sm font-semibold">The 5-step call</h2>
                <CallFlow />
              </div>
              {role && (
                <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                  <span>Show all scripts</span>
                  <Switch checked={showAll} onCheckedChange={setShowAll} />
                </label>
              )}
              <Accordion type="single" collapsible className="space-y-2">
                {scripts.map((s) => (
                  <AccordionItem key={s.id} value={s.id} className="rounded-md border px-3">
                    <AccordionTrigger className="min-h-11 text-left text-sm">{s.title}</AccordionTrigger>
                    <AccordionContent><ScriptCard script={s} values={v} recommended={isRoleMatch(s, role)} /></AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="objections" id="pb-objections" className="rounded-lg border px-4">
            <AccordionTrigger className="min-h-11">Universal objections</AccordionTrigger>
            <AccordionContent><ObjectionList items={universalObjections} values={v} /></AccordionContent>
          </AccordionItem>

          <AccordionItem value="voicemail" id="pb-voicemail" className="rounded-lg border px-4">
            <AccordionTrigger className="min-h-11">Voicemail scripts</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{voicemailTips}</p>
              <CopyText label="FSBO voicemail" text={fillTokens(voicemails.FSBO, v)} />
              <CopyText label="FRBO voicemail" text={fillTokens(voicemails.FRBO, v)} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="followup" id="pb-followup" className="rounded-lg border px-4">
            <AccordionTrigger className="min-h-11">Follow-up cadence & texts</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="divide-y divide-border rounded-md border border-border">
                {followUpCadence.map((c) => (
                  <div key={c.day} className="grid grid-cols-[4.5rem_1fr] gap-2 p-3 text-sm">
                    <span className="font-medium">Day {c.day}{c.day === 60 ? "+" : ""}</span>
                    <span>{c.touch}<span className="block text-xs text-muted-foreground">{c.purpose}</span></span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Text templates</p>
                {textTemplates.map((t) => <CopyText key={t.id} label={t.label} text={`${fillTokens(t.text, v)} ${textOptOutLine}`} />)}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DashboardLayout>
  );
}
