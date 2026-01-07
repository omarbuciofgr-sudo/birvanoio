import { Lightbulb, Heart, TrendingUp } from "lucide-react";

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
                At Brivano, we believe business growth starts with better data.
              </p>
              <p>
                What began as a small project to help local companies find real decision-makers 
                has evolved into a nationwide lead-generation powerhouse — powered by automation, 
                accuracy, and integrity.
              </p>
              <p>
                Every dataset we deliver is built from verified public sources, enriched through 
                automation, and manually checked for accuracy.
              </p>
              <p className="text-foreground font-medium">
                We're not another database — we're your partner in discovering the businesses 
                you actually want to work with.
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
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">Growth</h3>
              <p className="text-muted-foreground">
                We scale with you — from 100 leads a month to thousands across multiple cities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
