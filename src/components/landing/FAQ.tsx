import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Where do the leads come from?",
    answer: "Our proprietary scrapers collect data from verified public sources in real-time. Every lead includes contact info, source URL, and is manually verified for accuracy before delivery.",
  },
  {
    question: "Are leads shared with other customers?",
    answer: "No. Your leads are exclusively yours. We never resell or share leads between customers. With our Scale plan, you can even get zip-level exclusivity in your target areas.",
  },
  {
    question: "What is the AI Voice Agent?",
    answer: "Our AI Voice Agent can make outbound calls on your behalf, qualify leads, answer common questions, and log all conversations automatically. It speaks naturally and can handle complex conversations. Growth plans include limited minutes, while Scale plans include unlimited usage.",
  },
  {
    question: "How does call recording and transcription work?",
    answer: "Every call you make through Brivano is automatically recorded and stored securely. Our AI then transcribes the conversation and generates insights, including sentiment analysis and suggested follow-ups.",
  },
  {
    question: "What AI features are included?",
    answer: "Depending on your plan, you get access to: AI-powered call recaps, automatic follow-up email/SMS generation, lead scoring, sentiment analysis, message templates, weekly digest reports, and our AI voice agent for automated outreach.",
  },
  {
    question: "What if I get a bad lead?",
    answer: "We stand behind our data quality. If a lead has incorrect contact information, let us know and we'll replace it — no questions asked.",
  },
  {
    question: "Can I import my existing leads?",
    answer: "Absolutely. You can import leads via CSV directly into your CRM. All your data stays organized in one place alongside the fresh leads we deliver.",
  },
  {
    question: "Do I need to sign a long-term contract?",
    answer: "Nope. All plans are month-to-month with no long-term commitments. You can upgrade, downgrade, or cancel anytime.",
  },
  {
    question: "How does team pricing work?",
    answer: "Pricing is per seat. Each team member gets their own login, lead allocation, and full CRM access. Add or remove seats anytime as your team grows.",
  },
  {
    question: "Can I integrate Brivano with other tools?",
    answer: "Yes! Scale plan includes webhook integrations and API access, allowing you to connect Brivano with your existing tech stack — CRMs, marketing tools, and more.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know before getting started.
          </p>
        </div>

        {/* FAQ Accordion */}
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-primary/50"
            >
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5">
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
