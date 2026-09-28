import * as React from "react";
import { Sparkles, Bot, Gauge, MessageSquareText } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const services = [
  {
    icon: Bot,
    title: "AI Voice Agent · Beta",
    description: "Use the beta voice agent for automated outreach calls and lead qualification.",
  },
  {
    icon: Gauge,
    title: "Smart match scoring",
    description: "Ranks which listings are most likely to be real owner listings.",
  },
  {
    icon: MessageSquareText,
    title: "AI-written first messages",
    description: "Creates a personalized first message for each owner.",
  },
  {
    icon: Sparkles,
    title: "AI follow-up suggestions",
    description: "Suggests the next message and follow-up timing based on each lead.",
  },
];

const Services = React.forwardRef<HTMLDivElement>(function Services(_props, ref) {
  const { ref: scrollRef, isVisible } = useScrollAnimation();

  return (
    <div ref={ref} style={{ display: "contents" }}>
    <section id="services" className="py-24 bg-muted/30">
      <div ref={scrollRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Platform</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            AI that does the busy work
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Practical assistance for prioritizing listings and keeping owner conversations moving.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
          {services.map((service, index) => (
            <div
              key={service.title}
              className={`group p-6 rounded-xl hover:bg-card transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <service.icon className="w-5 h-5 text-primary mb-4" />
              <h3 className="font-display text-base font-semibold text-foreground mb-2">
                {service.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
    </div>
  );
});

Services.displayName = "Services";

export default Services;
