import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Where do the leads come from?",
    answer: "Our proprietary scrapers collect data from verified public sources in real-time. Every lead includes contact info, source URL, and is verified for accuracy before delivery.",
  },
  {
    question: "Are leads shared with other customers?",
    answer: "No. Your leads are exclusively yours. We never resell or share leads between customers. With our Scale plan, you can get zip-level exclusivity.",
  },
  {
    question: "What is the AI Voice Agent?",
    answer: "Our AI Voice Agent makes outbound calls, qualifies leads, answers questions, and logs conversations automatically. It speaks naturally and handles complex conversations.",
  },
  {
    question: "How does call recording work?",
    answer: "Every call is automatically recorded and stored securely. AI transcribes conversations and generates insights including sentiment analysis and suggested follow-ups.",
  },
  {
    question: "What AI features are included?",
    answer: "Depending on your plan: AI call recaps, follow-up generation, lead scoring, sentiment analysis, message templates, weekly digests, and the AI voice agent.",
  },
  {
    question: "What if I get a bad lead?",
    answer: "We stand behind our data quality. If a lead has incorrect contact information, let us know and we'll replace it — no questions asked.",
  },
  {
    question: "Can I import existing leads?",
    answer: "Yes. Import via CSV directly into your CRM. All data stays organized alongside fresh leads we deliver.",
  },
  {
    question: "Do I need a long-term contract?",
    answer: "No. All plans are month-to-month. Upgrade, downgrade, or cancel anytime.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-24 bg-muted/30">
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
      </div>
    </section>
  );
};

export default FAQ;
