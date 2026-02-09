import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot } from "lucide-react";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-16 overflow-hidden">
      {/* Subtle dot pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Subtle gradient orb */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground mb-10 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI-Powered Lead Generation
          </div>

          {/* Headline */}
          <h1 
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in text-foreground"
            style={{ animationDelay: "0.1s" }}
          >
            Find, enrich & close
            <br />
            <span className="gradient-text">leads with AI.</span>
          </h1>

          {/* Subheadline */}
          <p 
            className="text-lg text-muted-foreground max-w-xl mx-auto mb-12 animate-fade-in leading-relaxed"
            style={{ animationDelay: "0.2s" }}
          >
            Scrape leads from any industry, enrich with verified data, and automate outreach — all from one platform.
          </p>

          {/* CTA Buttons */}
          <div 
            className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-base group"
              onClick={() => navigate("/auth")}
            >
              Start Free
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border hover:bg-muted px-8 py-6 text-base"
              onClick={() => navigate("/auth?demo=true")}
            >
              <Bot className="w-4 h-4 mr-2" />
              Get a Demo
            </Button>
          </div>

          {/* Minimal stats */}
          <div 
            className="flex items-center justify-center gap-8 sm:gap-12 mt-16 animate-fade-in"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-display">100+</p>
              <p className="text-xs text-muted-foreground mt-1">Data providers</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-display">AI</p>
              <p className="text-xs text-muted-foreground mt-1">Voice agent</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-display">∞</p>
              <p className="text-xs text-muted-foreground mt-1">Calls & emails</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
