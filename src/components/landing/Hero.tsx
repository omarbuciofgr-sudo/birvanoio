import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, Target } from "lucide-react";

const Hero = () => {
  const scrollToContact = () => {
    document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-secondary/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: "-3s" }} />
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Leads + CRM in One Platform</span>
          </div>

          {/* Headline */}
          <h1 
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="text-foreground">Your Team.</span>
            <br />
            <span className="gradient-text">Your Leads. Your CRM.</span>
          </h1>

          {/* Subheadline */}
          <p 
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            Brivano delivers verified B2B leads directly into a powerful CRM built for sales teams of any size. 
            From solo reps to enterprise agencies — close more deals with less effort.
          </p>

          {/* CTA Buttons */}
          <div 
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6 glow-box group"
              onClick={scrollToContact}
            >
              Start Generating Leads
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border hover:bg-secondary text-lg px-8 py-6"
              onClick={() => document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              View Pricing
            </Button>
          </div>

          {/* Trust Indicators */}
          <div 
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto animate-fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
              <Target className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Verified Leads</span>
            </div>
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Built-in CRM</span>
            </div>
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">AI-Powered Tools</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
