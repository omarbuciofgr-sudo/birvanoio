import { Database, Users, Lock, Package } from "lucide-react";

const services = [
  {
    icon: Database,
    title: "Intelligent Data Sourcing",
    description: "Our proprietary scrapers collect live data from verified public sources - business registrations, chamber events, industry directories, and local listings - ensuring every lead is up to date and relevant to your exact niche.",
  },
  {
    icon: Users,
    title: "Human Quality Control",
    description: "Every dataset goes through manual QC to confirm accuracy. We verify emails, phone numbers, source URL, and point of contact details so your team can trust the data they're calling.",
  },
  {
    icon: Lock,
    title: "Exclusivity & Customization",
    description: "No recycled lists. You choose your cities, industries, and search filters. No matter what niche we can find it. Your leads are exclusively yours.",
  },
  {
    icon: Package,
    title: "Add-On Services",
    description: "From multi-city searches to full exclusivity, our exports fit right into your CRM (CSV, JSON) and even done-for-you appointment setting. Brivano adapts to your growth strategy.",
  },
];

const Services = () => {
  return (
    <section id="services" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Our Process & <span className="gradient-text">Capabilities</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We don't sell databases — we deliver fresh intelligence tailored to your business needs.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <service.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                {service.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-card border border-border">
            <span className="text-muted-foreground">Works with any B2B niche:</span>
            <span className="text-foreground font-medium">Real Estate • Healthcare • Insurance • SaaS • And More</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;
