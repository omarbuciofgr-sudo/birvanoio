import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Sparkles, Database, Bot, Globe } from "lucide-react";

const Hero = () => {
  const navigate = useNavigate();

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
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">AI-Powered Lead Generation & CRM Platform</span>
          </div>

          {/* Headline */}
          <h1 
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="gradient-text">Find, Enrich & Close</span>
            <br />
            <span className="text-foreground">Leads With AI.</span>
          </h1>

          {/* Subheadline */}
          <p 
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            Scrape leads from any industry, enrich with verified contact data, and automate outreach — 
            all from one self-service platform powered by AI. No sales calls needed.
          </p>

          {/* CTA Buttons */}
          <div 
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6 glow-box group"
              onClick={() => navigate("/auth")}
            >
              Start Free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border hover:bg-secondary text-lg px-8 py-6"
              onClick={() => navigate("/auth?demo=true")}
            >
              <Bot className="w-5 h-5 mr-2" />
              Get a Demo
            </Button>
          </div>

          {/* Trust Indicators */}
          <div 
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto animate-fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
              <Database className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Self-Service Scraping</span>
            </div>
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">AI Enrichment</span>
            </div>
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">AI Voice Agent</span>
            </div>
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
              <Globe className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">100+ Data Providers</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
