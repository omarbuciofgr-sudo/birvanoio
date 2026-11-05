import { Link } from "react-router-dom";
import { ExternalLink, SearchCheck, Phone } from "lucide-react";

const details = [
  { icon: ExternalLink, title: "Check the listing yourself", text: "Search public property listings by city, including Zillow and rental-listing sites. Each result has listing links so you can check the address, asking price and whether the property is still available. Source coverage varies by market." },
  { icon: SearchCheck, title: "A match score is a starting point", text: "Best matches prioritizes listings scored as likely for sale or rent by owner. Scores and qualification reasons help you decide which listings to review. A high score is not proof of ownership, a working phone number or permission to call." },
  { icon: Phone, title: "Look up a contact when you need it", text: "Press Find contact info to request an owner's available phone number or email. Some lookups return only one, and some return neither. A miss uses no credits or free lookups. A returned contact can still be outdated, so check who you reach." },
];

export default function DataQuality() {
  return (
    <section className="bg-muted/30 py-20" aria-labelledby="data-quality-title">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">Before your morning dial block</p>
          <h2 id="data-quality-title" className="font-display text-3xl font-bold text-foreground sm:text-4xl">Know what a listing and a contact can tell you</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">FSBO leads and FRBO leads are opportunities to review, not guaranteed appointments. Brivano puts the listing, skip tracing and follow-up history in one place.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">{details.map(({ icon: Icon, title, text }) => <div key={title}><Icon className="mb-4 h-6 w-6 text-primary" /><h3 className="mb-3 font-semibold text-foreground">{title}</h3><p className="text-sm leading-7 text-muted-foreground">{text}</p></div>)}</div>
        <p className="mt-10 border-t border-border pt-6 text-sm leading-7 text-muted-foreground">Search results can be cached, and listing sites may update before Brivano does. We do not promise real-time freshness or a verified-contact success rate. Before outreach, check Do Not Call requirements and get the consent your channel requires. <Link to="/terms" className="text-primary underline underline-offset-4">Read the outreach responsibilities</Link>.</p>
      </div>
    </section>
  );
}