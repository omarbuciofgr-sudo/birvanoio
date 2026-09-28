import * as React from "react";
import { Search, Contact, Mail } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Search a city",
    description: "Choose selling, renting, or both to find owner-listed properties in any US city.",
  },
  {
    icon: Contact,
    step: "02",
    title: "Get owner contact info",
    description: "Select the best matches and find the owner name, phone number, and email when available.",
  },
  {
    icon: Mail,
    step: "03",
    title: "Reach out and track it",
    description: "Save owners to My Leads, send messages, schedule follow-ups, and track every conversation.",
  },
];

const HowItWorks = React.forwardRef<HTMLDivElement>(function HowItWorks(_props, ref) {
  const { ref: scrollRef, isVisible } = useScrollAnimation();

  return (
    <div ref={ref} style={{ display: "contents" }}>
    <section id="how-it-works" className="py-24">
      <div ref={scrollRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Process</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
            How it works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
              style={{ transitionDelay: `${index * 120}ms` }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-border bg-card mb-5">
                <step.icon className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-2">{step.step}</p>
              <h3 className="font-display text-base font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
    </div>
  );
});

HowItWorks.displayName = "HowItWorks";

export default HowItWorks;
