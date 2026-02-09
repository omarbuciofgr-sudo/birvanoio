import { Database, Search, Mail, BarChart3, Bot, Target } from "lucide-react";

const useCases = [
  { icon: Database, label: "CRM enrichment & maintenance", color: "bg-orange-50 dark:bg-orange-950/30" },
  { icon: Search, label: "TAM sourcing & territory planning", color: "bg-blue-50 dark:bg-blue-950/30" },
  { icon: Mail, label: "Inbound lead enrichment & routing", color: "bg-purple-50 dark:bg-purple-950/30" },
  { icon: Target, label: "Intent-based outreach flows", color: "bg-yellow-50 dark:bg-yellow-950/30" },
  { icon: Bot, label: "AI-powered outbound campaigns", color: "bg-rose-50 dark:bg-rose-950/30" },
  { icon: BarChart3, label: "Account-based marketing", color: "bg-green-50 dark:bg-green-950/30" },
];

const UseCases = () => {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/10" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-secondary/30 border border-border p-12 lg:p-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Brivano's data + AI unlock any{" "}
                <span className="gradient-text">growth use case</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Use the best data foundation alongside AI-powered workflows to turn any growth idea 
                into reality — from CRM enrichment to intent-based outbound. 
                Iterate quickly to scale your best experiments.
              </p>
            </div>

            {/* Right - Use Cases */}
            <div className="space-y-3">
              {useCases.map((useCase) => (
                <div
                  key={useCase.label}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${useCase.color} flex items-center justify-center flex-shrink-0`}>
                    <useCase.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-foreground font-medium">{useCase.label}</span>
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
