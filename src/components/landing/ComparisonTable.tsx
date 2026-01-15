import { Check, X, Minus } from "lucide-react";

const features = [
  { name: "Verified B2B Leads", brivano: true, apollo: true, zoominfo: true, lusha: "partial" },
  { name: "Built-in CRM", brivano: true, apollo: "partial", zoominfo: false, lusha: false },
  { name: "AI Voice Agent", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "Click-to-Call with Recording", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "AI Call Recaps & Transcription", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "Lead Scoring", brivano: true, apollo: true, zoominfo: true, lusha: false },
  { name: "Sentiment Analysis", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "AI Message Templates", brivano: true, apollo: "partial", zoominfo: false, lusha: false },
  { name: "Exclusive Lead Data", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "Webhook Integrations", brivano: true, apollo: true, zoominfo: true, lusha: "partial" },
  { name: "Zip-Level Exclusivity", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "Starting Price (per seat)", brivano: "$49/mo", apollo: "$99/mo", zoominfo: "$15K/yr", lusha: "$79/mo" },
];

const FeatureCell = ({ value }: { value: boolean | string }) => {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="w-4 h-4 text-primary" />
        </div>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <X className="w-4 h-4 text-destructive" />
        </div>
      </div>
    );
  }
  if (value === "partial") {
    return (
      <div className="flex justify-center">
        <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <Minus className="w-4 h-4 text-yellow-500" />
        </div>
      </div>
    );
  }
  return <span className="text-sm text-foreground font-medium">{value}</span>;
};

const ComparisonTable = () => {
  return (
    <section id="compare" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/10 to-background" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            How We <span className="gradient-text">Compare</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See why teams choose Brivano over traditional lead providers and CRMs.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-4 text-muted-foreground font-medium">Feature</th>
                <th className="py-4 px-4 text-center">
                  <div className="inline-flex flex-col items-center">
                    <span className="font-display text-lg font-bold gradient-text">Brivano</span>
                    <span className="text-xs text-muted-foreground">All-in-One</span>
                  </div>
                </th>
                <th className="py-4 px-4 text-center">
                  <div className="inline-flex flex-col items-center">
                    <span className="font-display text-lg font-bold text-foreground">Apollo</span>
                    <span className="text-xs text-muted-foreground">Data + Outreach</span>
                  </div>
                </th>
                <th className="py-4 px-4 text-center">
                  <div className="inline-flex flex-col items-center">
                    <span className="font-display text-lg font-bold text-foreground">ZoomInfo</span>
                    <span className="text-xs text-muted-foreground">Data Only</span>
                  </div>
                </th>
                <th className="py-4 px-4 text-center">
                  <div className="inline-flex flex-col items-center">
                    <span className="font-display text-lg font-bold text-foreground">Lusha</span>
                    <span className="text-xs text-muted-foreground">Contact Data</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr
                  key={feature.name}
                  className={`border-b border-border/50 ${
                    index % 2 === 0 ? "bg-card/30" : ""
                  }`}
                >
                  <td className="py-4 px-4 text-foreground">{feature.name}</td>
                  <td className="py-4 px-4 bg-primary/5">
                    <FeatureCell value={feature.brivano} />
                  </td>
                  <td className="py-4 px-4">
                    <FeatureCell value={feature.apollo} />
                  </td>
                  <td className="py-4 px-4">
                    <FeatureCell value={feature.zoominfo} />
                  </td>
                  <td className="py-4 px-4">
                    <FeatureCell value={feature.lusha} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            <Check className="w-4 h-4 text-primary inline mr-1" /> Full support
            <Minus className="w-4 h-4 text-yellow-500 inline ml-4 mr-1" /> Partial/Add-on
            <X className="w-4 h-4 text-destructive inline ml-4 mr-1" /> Not available
          </p>
        </div>
      </div>
    </section>
  );
};

export default ComparisonTable;
