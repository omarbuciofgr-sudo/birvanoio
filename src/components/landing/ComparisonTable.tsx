import { Check, X, Minus } from "lucide-react";

const features = [
  { name: "Verified B2B Leads", brivano: true, apollo: true, zoominfo: true, lusha: "partial" },
  { name: "Built-in CRM", brivano: true, apollo: "partial", zoominfo: false, lusha: false },
  { name: "AI Voice Agent", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "Click-to-Call with Recording", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "AI Call Recaps", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "Lead Scoring", brivano: true, apollo: true, zoominfo: true, lusha: false },
  { name: "Sentiment Analysis", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "AI Message Templates", brivano: true, apollo: "partial", zoominfo: false, lusha: false },
  { name: "Exclusive Lead Data", brivano: true, apollo: false, zoominfo: false, lusha: false },
  { name: "Webhook Integrations", brivano: true, apollo: true, zoominfo: true, lusha: "partial" },
  { name: "Starting Price", brivano: "$49/mo", apollo: "$99/mo", zoominfo: "$15K/yr", lusha: "$79/mo" },
];

const FeatureCell = ({ value }: { value: boolean | string }) => {
  if (value === true) return <Check className="w-4 h-4 text-primary mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  if (value === "partial") return <Minus className="w-4 h-4 text-muted-foreground mx-auto" />;
  return <span className="text-sm text-foreground font-medium">{value}</span>;
};

const ComparisonTable = () => {
  return (
    <section id="compare" className="py-24 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Compare</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
            How we stack up
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Feature</th>
                <th className="py-3 px-4 text-center font-display font-bold text-primary">Brivano</th>
                <th className="py-3 px-4 text-center text-muted-foreground font-medium">Apollo</th>
                <th className="py-3 px-4 text-center text-muted-foreground font-medium">ZoomInfo</th>
                <th className="py-3 px-4 text-center text-muted-foreground font-medium">Lusha</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr key={feature.name} className="border-b border-border/50">
                  <td className="py-3 px-4 text-foreground">{feature.name}</td>
                  <td className="py-3 px-4 bg-primary/[0.03]"><FeatureCell value={feature.brivano} /></td>
                  <td className="py-3 px-4"><FeatureCell value={feature.apollo} /></td>
                  <td className="py-3 px-4"><FeatureCell value={feature.zoominfo} /></td>
                  <td className="py-3 px-4"><FeatureCell value={feature.lusha} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default ComparisonTable;
