import { useState } from "react";
import { Calculator, DollarSign, Users, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const ROICalculator = () => {
  const [reps, setReps] = useState(5);
  const [avgDealSize, setAvgDealSize] = useState(5000);
  const [currentCloseRate, setCurrentCloseRate] = useState(10);

  // Calculations
  const leadsPerRepPerMonth = 150; // Growth plan
  const totalLeads = reps * leadsPerRepPerMonth;
  const improvedCloseRate = currentCloseRate * 1.35; // 35% improvement with AI tools
  const currentDeals = Math.round((totalLeads * currentCloseRate) / 100);
  const projectedDeals = Math.round((totalLeads * improvedCloseRate) / 100);
  const currentRevenue = currentDeals * avgDealSize;
  const projectedRevenue = projectedDeals * avgDealSize;
  const additionalRevenue = projectedRevenue - currentRevenue;
  const brivanoCost = reps * 99; // Growth plan pricing
  const roi = Math.round(((additionalRevenue - brivanoCost) / brivanoCost) * 100);

  return (
    <section id="roi-calculator" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Calculator className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">ROI Calculator</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Calculate Your <span className="gradient-text">Potential ROI</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See how much additional revenue Brivano could generate for your team.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Inputs */}
          <div className="p-8 rounded-2xl bg-card border border-border">
            <h3 className="font-display text-xl font-bold text-foreground mb-8">Your Team Details</h3>
            
            <div className="space-y-8">
              {/* Number of Reps */}
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-foreground font-medium">Number of Sales Reps</label>
                  <span className="text-primary font-bold">{reps}</span>
                </div>
                <Slider
                  value={[reps]}
                  onValueChange={(v) => setReps(v[0])}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Average Deal Size */}
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-foreground font-medium">Average Deal Size</label>
                  <span className="text-primary font-bold">${avgDealSize.toLocaleString()}</span>
                </div>
                <Slider
                  value={[avgDealSize]}
                  onValueChange={(v) => setAvgDealSize(v[0])}
                  min={500}
                  max={50000}
                  step={500}
                  className="w-full"
                />
              </div>

              {/* Current Close Rate */}
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-foreground font-medium">Current Close Rate</label>
                  <span className="text-primary font-bold">{currentCloseRate}%</span>
                </div>
                <Slider
                  value={[currentCloseRate]}
                  onValueChange={(v) => setCurrentCloseRate(v[0])}
                  min={1}
                  max={30}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-secondary/50 border border-border">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Based on Growth Plan:</strong> 150 leads/rep/month, AI voice agent, lead scoring, and automated follow-ups.
              </p>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {/* Monthly Leads */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Leads Generated</p>
                  <p className="font-display text-3xl font-bold text-foreground">
                    {totalLeads.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Revenue Comparison */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Revenue Potential</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-xl bg-secondary/50">
                  <p className="text-xs text-muted-foreground mb-1">Current (est.)</p>
                  <p className="font-display text-xl font-bold text-foreground">
                    ${currentRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentDeals} deals @ {currentCloseRate}%
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-xs text-primary mb-1">With Brivano</p>
                  <p className="font-display text-xl font-bold gradient-text">
                    ${projectedRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {projectedDeals} deals @ {improvedCloseRate.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-primary font-medium">
                  +${additionalRevenue.toLocaleString()}/month additional revenue
                </span>
              </div>
            </div>

            {/* ROI */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Projected ROI</p>
                <p className="font-display text-5xl font-bold gradient-text mb-2">
                  {roi > 0 ? `${roi}%` : "Calculate above"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Brivano cost: ${brivanoCost}/month for {reps} seats
                </p>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              Start Your Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ROICalculator;
