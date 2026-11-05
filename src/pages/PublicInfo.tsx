import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ProductDemo from "@/components/landing/ProductDemo";
import CustomerProof from "@/components/landing/CustomerProof";
import DataQuality from "@/components/landing/DataQuality";
import FAQ from "@/components/landing/FAQ";
import Pricing from "@/components/landing/Pricing";
import { Button } from "@/components/ui/button";
import { customerStories, founderProof, thirdPartyProof } from "@/data/websiteProof";

type PageKind = "about" | "features" | "customers" | "pricing";
const pageDetails = {
  about: { title: "About Brivano | FSBO & FRBO Prospecting", description: "Learn about Brivano, a workspace for finding FSBO and FRBO owners, looking up contacts, and tracking real estate outreach.", heading: "About Brivano", intro: "A workspace for real estate agents, investors, leasing agents and property managers who reach out to owners selling or renting on their own." },
  features: { title: "FSBO & FRBO Lead Tools, Scripts & Follow-Ups | Brivano", description: "Explore Brivano's city search, owner contact lookups, FSBO and FRBO scripts, call tracking, follow-ups and editable AI drafts.", heading: "FSBO and FRBO prospecting tools", intro: "Search a city, review owner-listed properties, get available contact information and track your next conversation." },
  customers: { title: "Brivano for Agents, Investors & Property Managers", description: "See how Brivano fits listing agents, investors, leasing agents and property managers prospecting FSBO and FRBO owners.", heading: "Who uses Brivano?", intro: "Different roles, the same starting point: a homeowner selling or renting without an agent." },
  pricing: { title: "Brivano Pricing | FSBO & FRBO Lead Plans", description: "Compare Free, Starter, Growth and Scale plans. See monthly city searches, contact lookup credit costs and AI message allowances.", heading: "Brivano pricing", intro: "Choose a plan for your prospecting routine. Start free and see credit costs before you act." },
};

const features = [
  ["Find Owners", "Search any US city for selling or renting listings. Filter the results, open the original listing and save owners to My Leads."],
  ["Owner contact lookups", "Request available phone numbers and email addresses with Find contact info. No-match lookups do not use credits or free lookups."],
  ["Prospecting Playbook", "Use role-specific FSBO and FRBO openers, discovery questions, objections, voicemails and text templates. Open the matching script on a saved lead."],
  ["Call Tracking and daily goals", "Log the outcome, date and next step for each lead. Follow your daily contacted and completed-follow-up goals."],
  ["Follow-ups and pipeline", "Schedule calls or texts and track leads from New through Contacted, Appointment set, Listing signed or Lost. Review every message before sending."],
  ["AI-written drafts", "Ask for first messages, talking points and follow-up suggestions. Edit the draft before you send it. AI Voice Agent is Beta and requires recorded lead consent."],
];

export default function PublicInfo({ kind }: { kind: PageKind }) {
  const page = pageDetails[kind];
  const canonical = `https://www.brivano.io/${kind}`;
  return <div className="min-h-screen bg-background text-foreground">
    <Helmet><title>{page.title}</title><meta name="description" content={page.description} /><link rel="canonical" href={canonical} /><meta property="og:title" content={page.title} /><meta property="og:description" content={page.description} /><meta property="og:url" content={canonical} /><meta property="og:type" content="website" /><meta name="twitter:card" content="summary_large_image" />{kind === "customers" && customerStories.length === 0 && <meta name="robots" content="noindex, follow" />}</Helmet>
    <Navbar />
    <main>
      <section className="mx-auto max-w-5xl px-4 pb-14 pt-32 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">{page.heading}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{page.intro}</p>
        <Button asChild className="mt-8 min-h-11 gap-2"><Link to="/auth?mode=signup">Start Free <ArrowRight className="h-4 w-4" /></Link></Button>
      </section>
      {kind === "about" && <section className="mx-auto max-w-5xl space-y-10 px-4 pb-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl"><h2 className="mb-4 font-display text-2xl font-bold">One place for your prospecting routine</h2><p className="leading-8 text-muted-foreground">Looking for owner-listed homes is only the first step. Brivano connects city searches, available owner contacts, scripts, call outcomes and follow-ups so you can keep a record of who you contacted and what comes next.</p><p className="mt-4 leading-8 text-muted-foreground">The focus is US FSBO and FRBO prospecting. It is not a promise of exclusive listings, perfect contact data or a signed listing. You choose the owners to contact and review messages before they go out.</p></div>
        {founderProof && <div className="grid gap-6 sm:grid-cols-[160px_1fr]"><img src={founderProof.photoUrl} alt={founderProof.name} className="aspect-square w-40 rounded-lg object-cover" /><div><h2 className="font-display text-2xl font-bold">{founderProof.name}, founder</h2><p className="mt-4 whitespace-pre-line leading-8 text-muted-foreground">{founderProof.story}</p><a href={founderProof.profileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-primary underline">Meet the founder</a></div></div>}
        {thirdPartyProof.length > 0 && <div><h2 className="mb-4 font-display text-2xl font-bold">In the community</h2>{thirdPartyProof.map(proof => <p key={proof.url}><a href={proof.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{proof.title}</a> <span className="text-muted-foreground">{proof.date}</span></p>)}</div>}
        <div className="border-t border-border pt-8"><h2 className="mb-3 font-display text-2xl font-bold">Talk to Brivano</h2><p className="text-muted-foreground">Questions about the product? <a href="mailto:info@brivano.io" className="text-primary underline">info@brivano.io</a> · <a href="tel:8723070387" className="text-primary underline">(872) 307-0387</a></p></div>
      </section>}
      {kind === "features" && <><ProductDemo /><section className="mx-auto grid max-w-5xl gap-x-10 gap-y-12 px-4 py-20 sm:px-6 md:grid-cols-2 lg:px-8">{features.map(([title, text]) => <div key={title}><h2 className="mb-3 font-display text-xl font-bold">{title}</h2><p className="leading-7 text-muted-foreground">{text}</p></div>)}<Link to="/who-we-help/agents" className="text-primary underline">Explore FSBO leads and sample scripts</Link><Link to="/pricing" className="text-primary underline">See plans and credit costs</Link></section><DataQuality /><FAQ /></>}
      {kind === "customers" && <><section className="mx-auto grid max-w-5xl gap-8 px-4 pb-16 sm:px-6 md:grid-cols-3 lg:px-8">{[
        ["Real Estate Agents", "Find FSBO sellers, prepare your opener and track listing conversations.", "agents"],
        ["Property Managers", "Find independent rental owners and keep leasing and management follow-ups organized.", "property-managers"],
        ["Investors", "Review owner-listed sale and rental opportunities, look up available contacts and log your next step.", "investors"],
      ].map(([name, text, path]) => <div key={name}><h2 className="mb-3 font-display text-xl font-bold">{name}</h2><p className="mb-4 leading-7 text-muted-foreground">{text}</p><Link to={`/who-we-help/${path}`} className="text-primary underline">Explore {name.toLowerCase()}</Link></div>)}</section><CustomerProof /><section className="mx-auto max-w-5xl border-t border-border px-4 py-12 sm:px-6 lg:px-8"><h2 className="mb-3 font-display text-2xl font-bold">Share your experience</h2><p className="text-muted-foreground">Using Brivano for your prospecting? Tell us what happened at <a href="mailto:info@brivano.io" className="text-primary underline">info@brivano.io</a>.</p></section></>}
      {kind === "pricing" && <><Pricing /><FAQ /></>}
    </main>
    <Footer />
  </div>;
}