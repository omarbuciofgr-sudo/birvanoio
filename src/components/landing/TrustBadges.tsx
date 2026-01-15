import { Shield, Lock, RefreshCw, Award, Clock, HeadphonesIcon } from "lucide-react";

const badges = [
  {
    icon: Shield,
    title: "SOC 2 Compliant",
    description: "Enterprise-grade security",
  },
  {
    icon: Lock,
    title: "GDPR Ready",
    description: "Data privacy protected",
  },
  {
    icon: RefreshCw,
    title: "30-Day Guarantee",
    description: "Full refund, no questions",
  },
  {
    icon: Award,
    title: "99.9% Uptime",
    description: "Reliable platform",
  },
  {
    icon: Clock,
    title: "24/7 Monitoring",
    description: "Always running smoothly",
  },
  {
    icon: HeadphonesIcon,
    title: "Dedicated Support",
    description: "Real humans, fast response",
  },
];

const TrustBadges = () => {
  return (
    <section className="py-16 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h3 className="font-display text-2xl font-bold text-foreground">
            Built for <span className="gradient-text">Enterprise Security</span>
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {badges.map((badge) => (
            <div
              key={badge.title}
              className="p-4 rounded-xl bg-card/50 border border-border/50 text-center hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <badge.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">{badge.title}</p>
              <p className="text-xs text-muted-foreground">{badge.description}</p>
            </div>
          ))}
        </div>

        {/* Money Back Guarantee Banner */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 text-center">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center md:text-left">
              <h4 className="font-display text-xl font-bold text-foreground mb-1">
                30-Day Money-Back Guarantee
              </h4>
              <p className="text-muted-foreground">
                Not seeing results? Get a full refund within 30 days. No questions asked, no hassle.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
