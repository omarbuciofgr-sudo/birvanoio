import { Phone, MessageSquare, Mic, Sparkles, Bot, BarChart3 } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const features = [
  { icon: Phone, title: "Click-to-Call", description: "Call leads directly from your dashboard with automatic logging" },
  { icon: Bot, title: "AI Voice Agent", description: "Automated calls with natural conversation and smart qualification" },
  { icon: Mic, title: "Transcription", description: "Every call recorded, transcribed, and analyzed for insights" },
  { icon: Sparkles, title: "AI Follow-ups", description: "Automatic recaps, follow-up emails, and pipeline digests" },
  { icon: BarChart3, title: "Lead Scoring", description: "AI scores leads and analyzes conversation sentiment" },
  { icon: MessageSquare, title: "SMS & Email", description: "Send texts and emails without leaving the platform" },
];

const CRMShowcase = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-24">
      <div ref={ref} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">CRM + AI</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            A complete sales platform
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Call, text, and email leads directly. Every interaction is logged and enhanced with AI.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`p-5 rounded-xl border border-border bg-card hover:border-primary/20 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 60}ms` }}
            >
              <feature.icon className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-display text-sm font-semibold text-foreground mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CRMShowcase;
