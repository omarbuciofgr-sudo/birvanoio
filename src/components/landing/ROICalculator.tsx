import { useState } from "react";
import { Users, DollarSign, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const ROICalculator = () => {
  const [reps, setReps] = useState(5);
  const [avgDealSize, setAvgDealSize] = useState(5000);
  const [currentCloseRate, setCurrentCloseRate] = useState(10);

  const leadsPerRepPerMonth = 150;
  const totalLeads = reps * leadsPerRepPerMonth;
  const improvedCloseRate = currentCloseRate * 1.35;
  const currentDeals = Math.round((totalLeads * currentCloseRate) / 100);
  const projectedDeals = Math.round((totalLeads * improvedCloseRate) / 100);
  const currentRevenue = currentDeals * avgDealSize;
  const projectedRevenue = projectedDeals * avgDealSize;
  const additionalRevenue = projectedRevenue - currentRevenue;
  const brivanoCost = reps * 99;
  const roi = Math.round(((additionalRevenue - brivanoCost) / brivanoCost) * 100);

  return (
    <section id="roi-calculator" className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">ROI</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Calculate your potential ROI
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            See how much additional revenue Brivano could generate.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <h3 className="font-display text-base font-bold text-foreground mb-6">Your team</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-foreground">Sales Reps</label>
                  <span className="text-sm font-medium text-primary">{reps}</span>
                </div>
                <Slider value={[reps]} onValueChange={(v) => setReps(v[0])} min={1} max={50} step={1} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-foreground">Avg Deal Size</label>
                  <span className="text-sm font-medium text-primary">${avgDealSize.toLocaleString()}</span>
                </div>
                <Slider value={[avgDealSize]} onValueChange={(v) => setAvgDealSize(v[0])} min={500} max={50000} step={500} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-foreground">Close Rate</label>
                  <span className="text-sm font-medium text-primary">{currentCloseRate}%</span>
                </div>
                <Slider value={[currentCloseRate]} onValueChange={(v) => setCurrentCloseRate(v[0])} min={1} max={30} step={1} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Based on Growth Plan: 150 leads/rep/month with AI tools.</p>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-xl border border-border bg-card flex items-center gap-4">
              <Users className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Monthly Leads</p>
                <p className="font-display text-2xl font-bold text-foreground">{totalLeads.toLocaleString()}</p>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="w-5 h-5 text-primary" />
                <p className="text-xs text-muted-foreground">Revenue Potential</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground mb-1">Current</p>
                  <p className="font-display text-lg font-bold text-foreground">${currentRevenue.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/[0.06] border border-primary/10">
                  <p className="text-xs text-primary mb-1">With Brivano</p>
                  <p className="font-display text-lg font-bold gradient-text">${projectedRevenue.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-primary font-medium">+${additionalRevenue.toLocaleString()}/month</span>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-primary/20 bg-primary/[0.03] text-center">
              <p className="text-xs text-muted-foreground mb-1">Projected ROI</p>
              <p className="font-display text-4xl font-bold gradient-text">{roi > 0 ? `${roi}%` : "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">${brivanoCost}/mo for {reps} seats</p>
            </div>

            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              Start Your Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ROICalculator;
