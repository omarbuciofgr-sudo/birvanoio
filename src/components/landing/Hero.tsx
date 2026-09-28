import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Search, Contact, Send } from "lucide-react";

const Hero = React.forwardRef<HTMLElement>(function Hero(_props, ref) {
  const navigate = useNavigate();

  return (
    <section ref={ref} className="relative min-h-[90vh] flex items-center justify-center pt-16 overflow-hidden">
      {/* Subtle dot pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground mb-10 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Built for real estate professionals
          </div>

          {/* Headline — no fade-in to keep LCP fast */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-foreground">
            Find homeowners selling or renting on their own, before other agents do.
          </h1>

          {/* Subheadline */}
          <p 
            className="text-lg text-muted-foreground max-w-xl mx-auto mb-12 animate-fade-in leading-relaxed"
            style={{ animationDelay: "0.2s" }}
          >
            Search any US city for for-sale-by-owner and for-rent-by-owner listings, get the owner&apos;s contact info, and reach out from one place.
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
              onClick={() => document.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Play className="w-4 h-4 mr-2" />
              See how it works
            </Button>
          </div>

          {/* Three-step workflow */}
          <div 
            className="flex items-center justify-center gap-8 sm:gap-12 mt-16 animate-fade-in"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="flex items-center gap-2 text-sm font-medium"><Search className="h-4 w-4 text-primary" />Search a city</div>
            <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
            <div className="flex items-center gap-2 text-sm font-medium"><Contact className="h-4 w-4 text-primary" />Get owner contact info</div>
            <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
            <div className="flex items-center gap-2 text-sm font-medium"><Send className="h-4 w-4 text-primary" />Reach out and track it</div>
          </div>
        </div>
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

export default Hero;
