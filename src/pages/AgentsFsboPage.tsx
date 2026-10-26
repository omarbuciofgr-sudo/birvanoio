import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Contact, Search, Send } from "lucide-react";
import { BrivanoLogo } from "@/components/BrivanoLogo";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import { PLAYBOOK } from "@/data/playbookContent";

const steps = [
  { icon: Search, title: "Search your city", text: "Enter any US city and see homes listed for sale by owner, with price, days listed and a link to the original listing." },
  { icon: Contact, title: "Get owner contact info", text: "Click any owner to look up their name, phone and email when available. Save the ones you want to My Leads." },
  { icon: Send, title: "Call with a proven script", text: "Open the FSBO call script right on the lead, log the outcome, and set a follow-up so no seller slips through." },
];

function ScriptLines({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n+/).filter(Boolean).map((line, i) =>
        /^\[.*\]$/.test(line.trim()) ? (
          <p key={i} className="text-sm italic text-muted-foreground">{line}</p>
        ) : (
          <p key={i} className="text-foreground">{line}</p>
        ),
      )}
    </div>
  );
}

export default function AgentsFsboPage() {
  const { actionCosts } = usePricingSettings();
  const script = (PLAYBOOK as any).scripts?.find((s: any) => s.id === "fsbo-agent");
  const title = "FSBO Leads & Scripts for Real Estate Agents | Brivano";
  const description = "Find FSBO leads in any US city, get owner contact info, and call with ready-made FSBO scripts. Start free with Brivano.";

  const faqs = [
    { q: "What is an FSBO lead?", a: "An FSBO (for sale by owner) lead is a homeowner trying to sell without an agent. Many end up wanting help with pricing, marketing or paperwork, which makes them good listing opportunities." },
    { q: "Where do the FSBO listings come from?", a: "Brivano searches public owner-listed homes in the city you choose and links you to the original listing so you can check the details yourself." },
    { q: "What contact info do I get?", a: `Owner name, phone number and email when available. Each owner contact lookup uses ${actionCosts.owner_contact} credits, and a city search uses ${actionCosts.city_search}. Not every owner has contact info on file.` },
    { q: "Do you include FSBO scripts?", a: "Yes. The Playbook includes FSBO call scripts with openers, discovery questions, objection handling and voicemails, plus text templates. AI can also write a first message for any lead, which you review before sending." },
    { q: "Is there a free plan?", a: "Yes. You can start free, run your first city search, and upgrade from Billing when you need more credits." },
    { q: "What about Do Not Call rules?", a: "Brivano shows a calling notice before your first call or text, handles STOP replies automatically, and lets you mark any owner as Do not contact. You are still responsible for checking the Do Not Call registry." },
  ];

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://www.brivano.io/who-we-help/agents" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content="https://www.brivano.io/who-we-help/agents" />
      </Helmet>

      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/"><BrivanoLogo className="h-28" /></Link>
          <Button asChild size="sm"><Link to="/auth?mode=signup">Start Free</Link></Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">For real estate agents</p>
        <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">FSBO leads in your city, with the scripts to call them</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Find homeowners selling on their own, get their contact info, and reach out with FSBO scripts that sound like a real person, all in one place.
        </p>
        <Button asChild size="lg" className="mt-10 gap-2">
          <Link to="/auth?mode=signup">Start Free <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-10 text-center font-display text-3xl font-bold text-foreground">How to get FSBO leads with Brivano</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-6">
              <s.icon className="mb-4 h-6 w-6 text-primary" />
              <h3 className="mb-2 font-semibold text-foreground">{i + 1}. {s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 font-display text-3xl font-bold text-foreground">What contact info you get</h2>
        <div className="rounded-xl border border-border bg-card p-6">
          <ul className="space-y-2 text-foreground">
            <li>Owner name</li>
            <li>Phone number, when available</li>
            <li>Email address, when available</li>
            <li>Property details and a link to the original listing</li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            One owner contact lookup uses <strong className="text-foreground">{actionCosts.owner_contact} credits</strong>. A city search uses {actionCosts.city_search} credit. Every plan includes monthly credits, and your first city search is free.
          </p>
        </div>
      </section>

      {script && (
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="mb-2 font-display text-3xl font-bold text-foreground">Sample FSBO script</h2>
          <p className="mb-6 text-muted-foreground">A few lines from the FSBO call script included in the Brivano Playbook.</p>
          <div className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">Opener</p>
              <ScriptLines text={script.opener} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">Questions to ask</p>
              <ul className="list-disc space-y-1 pl-5 text-foreground">
                {script.discovery.slice(0, 3).map((q: string) => <li key={q}>{q}</li>)}
              </ul>
            </div>
            {script.objections?.[0] && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">When they say "{script.objections[0].theySay}"</p>
                <p className="text-foreground">{script.objections[0].youSay}</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 font-display text-3xl font-bold text-foreground">FSBO lead questions</h2>
        <Accordion type="single" collapsible>
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-foreground">Find your next FSBO listing today</h2>
        <p className="mt-4 text-muted-foreground">Search your city free and see who is selling on their own.</p>
        <Button asChild size="lg" className="mt-8 gap-2">
          <Link to="/auth?mode=signup">Start Free <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </section>
    </main>
  );
}
