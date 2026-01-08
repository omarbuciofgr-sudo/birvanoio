import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "We closed 3 new accounts in 30 days. The CRM keeps my team organized and the leads are actually picking up.",
    author: "Marcus T.",
    role: "Sales Director",
    company: "Austin Real Estate Group",
    metric: "3 deals in 30 days",
  },
  {
    quote: "Finally, a platform built for sales teams. My reps went from juggling 5 tools to just using Brivano.",
    author: "Jennifer L.",
    role: "VP of Sales",
    company: "SecureLife Insurance",
    metric: "5 tools → 1 platform",
  },
  {
    quote: "The AI recaps save us hours every week. Our follow-up game has never been stronger.",
    author: "David K.",
    role: "SDR Manager",
    company: "CloudScale SaaS",
    metric: "4+ hours saved weekly",
  },
  {
    quote: "We started with 2 seats and now have 15 reps on the platform. It scales perfectly with our growth.",
    author: "Sarah M.",
    role: "CEO",
    company: "GrowthFirst Agency",
    metric: "2 → 15 seats in 6 months",
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/20" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Trusted by Teams <span className="gradient-text">Big and Small</span> and More
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From solo reps to enterprise sales teams — see why businesses choose Brivano.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 flex flex-col"
            >
              {/* Result Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4 w-fit">
                {testimonial.metric}
              </div>
              
              <Quote className="w-8 h-8 text-primary/30 mb-4" />
              <p className="text-foreground leading-relaxed mb-6 flex-1">
                "{testimonial.quote}"
              </p>
              <div className="border-t border-border pt-4">
                <p className="font-medium text-foreground">{testimonial.author}</p>
                <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                <p className="text-xs text-muted-foreground/70">{testimonial.company}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
