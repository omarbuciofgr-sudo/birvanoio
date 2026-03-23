import { ArrowRight, TrendingUp, Users, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

const caseStudies = [
  {
    company: "Austin Real Estate Group",
    industry: "Real Estate",
    logo: "ARG",
    challenge: "Struggling to find motivated sellers in a competitive market",
    solution: "Used Brivano's FSBO scraping with AI voice agent for initial outreach",
    results: [
      { metric: "47%", label: "Increase in listings", icon: TrendingUp },
      { metric: "3.2x", label: "ROI in 90 days", icon: DollarSign },
      { metric: "15hrs", label: "Saved per week", icon: Clock },
    ],
    quote: "Brivano completely transformed our prospecting. We went from cold calling all day to having qualified conversations with motivated sellers.",
    author: "Marcus T., Sales Director",
  },
  {
    company: "SecureLife Insurance",
    industry: "Insurance",
    logo: "SLI",
    challenge: "Agents spending 70% of time on lead research instead of selling",
    solution: "Deployed Brivano CRM with automated lead scoring and AI follow-ups",
    results: [
      { metric: "156%", label: "More policies sold", icon: TrendingUp },
      { metric: "12", label: "Agents onboarded", icon: Users },
      { metric: "4hrs", label: "Daily time saved", icon: Clock },
    ],
    quote: "My reps went from juggling 5 different tools to just using Brivano. The AI call recaps alone save us hours every week.",
    author: "Jennifer L., VP of Sales",
  },
  {
    company: "GrowthFirst Agency",
    industry: "Marketing Agency",
    logo: "GFA",
    challenge: "Needed scalable lead gen for multiple client verticals",
    solution: "White-label Brivano with custom schemas per client industry",
    results: [
      { metric: "8", label: "New clients won", icon: Users },
      { metric: "$240K", label: "Additional MRR", icon: DollarSign },
      { metric: "2→15", label: "Team growth", icon: TrendingUp },
    ],
    quote: "We started with 2 seats and now have 15 reps on the platform. It scales perfectly with our growth and our clients love the results.",
    author: "Sarah M., CEO",
  },
];

const CaseStudies = () => {
  return (
    <section id="case-studies" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Real Results</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Success Stories from <span className="gradient-text">Real Teams</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See how sales teams across industries are crushing their goals with Brivano.
          </p>
        </div>

        {/* Case Studies Grid */}
        <div className="space-y-8">
          {caseStudies.map((study, index) => (
            <div
              key={study.company}
              className={`p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 ${
                index % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
            >
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                {/* Content */}
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-lg">{study.logo}</span>
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-bold text-foreground">
                        {study.company}
                      </h3>
                      <p className="text-sm text-muted-foreground">{study.industry}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Challenge
                      </p>
                      <p className="text-foreground">{study.challenge}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Solution
                      </p>
                      <p className="text-foreground">{study.solution}</p>
                    </div>
                  </div>

                  <blockquote className="border-l-2 border-primary pl-4 mb-6">
                    <p className="text-muted-foreground italic">"{study.quote}"</p>
                    <cite className="text-sm text-foreground font-medium not-italic mt-2 block">
                      — {study.author}
                    </cite>
                  </blockquote>
                </div>

                {/* Results */}
                <div className={`grid grid-cols-3 gap-4 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                  {study.results.map((result) => (
                    <div
                      key={result.label}
                      className="p-6 rounded-xl bg-secondary/50 border border-border text-center"
                    >
                      <result.icon className="w-6 h-6 text-primary mx-auto mb-3" />
                      <p className="font-display text-3xl font-bold text-foreground mb-1">
                        {result.metric}
                      </p>
                      <p className="text-xs text-muted-foreground">{result.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Button
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
          >
            Get Results Like These
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CaseStudies;
