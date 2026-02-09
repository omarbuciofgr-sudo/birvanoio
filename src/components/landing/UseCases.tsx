import { Database, Search, Mail, BarChart3, Bot, Target } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const useCases = [
  { icon: Database, label: "CRM enrichment & maintenance" },
  { icon: Search, label: "TAM sourcing & territory planning" },
  { icon: Mail, label: "Inbound lead enrichment & routing" },
  { icon: Target, label: "Intent-based outreach flows" },
  { icon: Bot, label: "AI-powered outbound campaigns" },
  { icon: BarChart3, label: "Account-based marketing" },
];

const UseCases = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-24">
      <div ref={ref} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`rounded-2xl border border-border bg-card p-10 lg:p-14 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Use Cases</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Unlock any growth use case
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Use the best data foundation alongside AI-powered workflows to turn any growth idea into reality.
              </p>
            </div>

            <div className="space-y-2">
              {useCases.map((useCase, index) => (
                <div
                  key={useCase.label}
                  className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-all duration-500 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
                  style={{ transitionDelay: `${300 + index * 80}ms` }}
                >
                  <useCase.icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground">{useCase.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UseCases;
