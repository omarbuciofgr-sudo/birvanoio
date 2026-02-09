import { Lightbulb, Heart, TrendingUp, Globe } from "lucide-react";

const values = [
  { icon: Lightbulb, title: "Innovation", description: "AI automation meets human oversight for leads that convert." },
  { icon: Heart, title: "Integrity", description: "No recycled lists. Every lead is fresh, verified, and exclusive." },
  { icon: TrendingUp, title: "Scalability", description: "From 1 seat to 100+ — pricing and features grow with you." },
  { icon: Globe, title: "Global Reach", description: "Any niche, any market, anywhere in the world." },
];

const About = () => {
  return (
    <section id="about" className="py-24 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">About</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Our story
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                At Brivano, we believe sales teams deserve better than recycled databases and clunky tools.
              </p>
              <p>
                We built an all-in-one platform that delivers fresh, verified leads into a CRM 
                designed for how modern teams actually work — with built-in calling, texting, email, and AI.
              </p>
              <p className="text-foreground font-medium">
                We're not just a lead provider — we're the platform your team uses to turn prospects into customers.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {values.map((value) => (
              <div key={value.title} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card">
                <value.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground mb-1">{value.title}</h3>
                  <p className="text-xs text-muted-foreground">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
