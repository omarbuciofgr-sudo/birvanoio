import { Lightbulb, Heart, TrendingUp, Globe } from "lucide-react";

const About = () => {
  return (
    <section id="about" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-6">
              Uncover Our <span className="gradient-text">Story</span>
            </h2>
            <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
              <p>
                At Brivano, we believe sales teams deserve better than recycled databases and clunky tools.
              </p>
              <p>
                We built an all-in-one platform that delivers fresh, verified leads directly into a CRM 
                designed for how modern teams actually work — with built-in calling, texting, email, and AI.
              </p>
              <p>
                Whether you are a solo rep building your book of business or an enterprise agency 
                managing hundreds of accounts, Brivano scales with you — <span className="text-foreground font-medium">no matter where in the world you operate</span>.
              </p>
              <p className="text-foreground font-medium">
                We are not just a lead provider — we are the platform your team uses to turn prospects into customers.
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">Innovation</h3>
              <p className="text-muted-foreground">
                We combine AI-powered automation with human oversight to deliver leads that actually convert.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">Integrity</h3>
              <p className="text-muted-foreground">
                No recycled lists, no outdated data. Every lead is fresh, verified, and exclusive to you.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">Scalability</h3>
              <p className="text-muted-foreground">
                From 1 seat to 100+ — our per-seat pricing and enterprise features grow with your team.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">Global Reach</h3>
              <p className="text-muted-foreground">
                We serve clients worldwide — from North America to Europe, Asia, and beyond. Any niche, any market, anywhere.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
