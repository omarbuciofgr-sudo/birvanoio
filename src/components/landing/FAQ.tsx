import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { usePricingSettings } from "@/hooks/usePricingSettings";

const questions = (ownerCost: number) => [
  {
    question: "Where do FSBO and FRBO listings come from, and how fresh are they?",
    answer: "Brivano searches public property-listing sources, including Zillow and rental-listing sites, for the city you choose. Results include listing links so you can check the details yourself. Searches can reuse cached results, and source updates may be delayed. We do not guarantee real-time listings or a measured freshness rate. Check that a property is still available before reaching out.",
  },
  {
    question: "Will every owner have a phone number and email?",
    answer: `No. Press Find contact info on a listing to request available owner contacts. You may get a phone number, an email, both or neither. Free users start with five successful lookups. After the free allowance, a successful paid lookup uses ${ownerCost} credits. If neither a phone nor an email is found, you use no credits or free lookups. A returned contact is not a guarantee that the number is current or that the person will respond.`,
  },
  {
    question: "Does Brivano scrub the Do Not Call registry or make outreach TCPA-compliant?",
    answer: "Brivano does not automatically scrub numbers against the national Do Not Call registry or guarantee TCPA compliance. Before app-initiated calling or texting, you must accept the outreach notice. Brivano maintains internal do-not-contact controls and processes STOP, UNSUBSCRIBE and CANCEL text replies to block further app texts. AI Voice Agent is Beta and requires a lead you have marked as having given consent. You must still check applicable DNC lists, consent requirements and calling hours before outreach. Calls or texts made through your phone's own apps are outside Brivano's sending controls.",
  },
  {
    question: "What does smart match scoring tell me?",
    answer: "Best matches helps prioritize listings scored as likely owner-listed, with qualification reasons when available. It is a shortlist to review, not verification of ownership, an accurate phone number, willingness to work with an agent or permission to contact the owner.",
  },
  {
    question: "Will AI send messages or follow-ups for me?",
    answer: "AI-written first messages and follow-up suggestions go into editable drafts. You review them and choose whether to send. AI writing does not use credits, but each plan has a monthly per-seat limit. AI Voice Agent is labeled Beta and is a separate, consent-gated calling feature.",
  },
  {
    question: "Do I need a credit card to start? How do paid plans work?",
    answer: "No credit card is required to create a Free account. Paid checkout is handled by Stripe, and you manage a paid subscription from Billing. Monthly and yearly options are shown above. Review the renewal terms at checkout. Charges are non-refundable except where required by law; we do not offer a money-back or contact-accuracy guarantee.",
  },
  {
    question: "How is owner contact information handled?",
    answer: "Brivano processes listings, owner contact lookups and outreach records to provide the service, with account and workspace access controls. The Privacy Policy explains service providers, retention and your choices. We do not sell personal information. Owner phone numbers and email addresses are not sent to the AI writing service. You are responsible for using contact information lawfully.",
  },
];

const FAQ = React.forwardRef<HTMLElement>(function FAQ(_props, ref) {
  const { actionCosts } = usePricingSettings();
  const faqs = questions(actionCosts.owner_contact);
  return (
    <section ref={ref} id="faq" className="py-24 bg-muted/30">
      <Helmet><script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(faq => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) })}</script></Helmet>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
            Common questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-border rounded-lg px-5 bg-card data-[state=open]:border-primary/30"
            >
              <AccordionTrigger className="text-left text-sm font-medium text-foreground hover:no-underline py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-8 text-center text-sm text-muted-foreground"><Link to="/privacy" className="text-primary underline">Privacy Policy</Link> · <Link to="/terms" className="text-primary underline">Terms and outreach responsibilities</Link></p>
      </div>
    </section>
  );
});

FAQ.displayName = "FAQ";

export default FAQ;
