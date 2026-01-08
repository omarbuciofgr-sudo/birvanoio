import { Phone, MessageSquare, Mail, Mic, Sparkles, LayoutDashboard } from "lucide-react";
import dashboardMockup from "@/assets/dashboard-mockup.png";

const features = [
  {
    icon: Phone,
    title: "Click-to-Call",
    description: "Call leads directly from your dashboard with automatic logging",
  },
  {
    icon: MessageSquare,
    title: "SMS & Email",
    description: "Send texts and emails without leaving the platform",
  },
  {
    icon: Mic,
    title: "Call Recording",
    description: "Every call is recorded and stored for training and compliance",
  },
  {
    icon: Sparkles,
    title: "AI Call Recaps",
    description: "Automatic follow-up emails and texts generated after each call",
  },
  {
    icon: LayoutDashboard,
    title: "Full CRM",
    description: "Track deals, log notes, and never lose context on a lead",
  },
  {
    icon: Mail,
    title: "Smart Follow-ups",
    description: "AI suggests the best time and message for your next touchpoint",
  },
];

const CRMShowcase = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <LayoutDashboard className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Built-in CRM + AI Tools</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            More Than Just Leads — <span className="gradient-text">A Complete Sales Platform</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Call, text, and email your leads directly from your dashboard. 
            Every interaction is logged, recorded, and enhanced with AI.
          </p>
        </div>

        {/* Features Grid + Screenshot */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Screenshot */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl blur-3xl" />
            <img
              src={dashboardMockup}
              alt="Brivano CRM Dashboard"
              className="relative rounded-2xl border border-border shadow-2xl shadow-primary/10"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CRMShowcase;
