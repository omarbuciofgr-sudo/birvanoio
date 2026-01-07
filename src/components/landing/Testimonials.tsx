import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "We closed 3 new accounts in 30 days. The data was fresh and actually picked up.",
    author: "Sales Director",
    company: "Real Estate Agency",
  },
  {
    quote: "Booked 9 meetings in two weeks from one city list.",
    author: "SDR Manager",
    company: "SaaS Startup",
  },
  {
    quote: "We tested their warm-appointments package—5 shows in 3 weeks. Way easier for my closers to focus on deals.",
    author: "CEO",
    company: "Insurance Brokerage",
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
            What Our <span className="gradient-text">Clients Say</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Real results from businesses using Brivano to power their pipelines.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300"
            >
              <Quote className="w-10 h-10 text-primary/30 mb-6" />
              <p className="text-foreground text-lg leading-relaxed mb-6">
                "{testimonial.quote}"
              </p>
              <div>
                <p className="font-medium text-foreground">{testimonial.author}</p>
                <p className="text-sm text-muted-foreground">{testimonial.company}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
