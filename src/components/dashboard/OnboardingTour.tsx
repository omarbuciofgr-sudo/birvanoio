import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LayoutDashboard, Users, Mail, Globe, Sparkles, Zap,
  Bot, FileText, ClipboardList, Settings, X, ArrowRight,
  ArrowLeft, Rocket, CheckCircle, Phone, Search, BarChart3,
} from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  tip?: string;
  navHint?: string;
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to Brivano! 🎉",
    description: "Let's walk you through the platform so you can start generating and closing leads in minutes. This quick tour covers all the key features.",
    icon: Rocket,
    tip: "You can always revisit this tour from Settings.",
  },
  {
    title: "Dashboard Overview",
    description: "Your command center. Track KPIs like total leads, conversion rates, and pipeline health at a glance. AI-powered insights surface trends and anomalies automatically.",
    icon: LayoutDashboard,
    navHint: "/dashboard",
  },
  {
    title: "Leads Management",
    description: "View, filter, and manage all your leads in one place. Use the Kanban board or table view, add notes, assign team members, and track every interaction.",
    icon: Users,
    navHint: "/dashboard/leads",
  },
  {
    title: "Brivano Scout — Prospecting",
    description: "Find new prospects by scraping business directories, websites, and databases. Set up automated scraping jobs with custom schemas to build your pipeline.",
    icon: Globe,
    navHint: "/dashboard/scraper",
  },
  {
    title: "Email Campaigns",
    description: "Create multi-step email sequences with personalized templates. Enroll leads into campaigns and track opens, clicks, and replies.",
    icon: Mail,
    navHint: "/dashboard/campaigns",
  },
  {
    title: "AI Agents",
    description: "Deploy AI agents to automate lead scoring, outreach, qualification, and follow-ups. Each agent can be customized with its own prompt and tools.",
    icon: Sparkles,
    navHint: "/dashboard/ai-agents",
  },
  {
    title: "Intent Signals",
    description: "Monitor real-time buying signals from your leads — job changes, funding rounds, tech stack updates, and more. Act on intent before your competitors.",
    icon: Zap,
    navHint: "/dashboard/signals",
  },
  {
    title: "Voice Agent",
    description: "Use AI-powered voice calls to reach leads at scale. Calls use your verified caller ID so prospects see your real business number.",
    icon: Bot,
    navHint: "/dashboard/voice-agent",
  },
  {
    title: "Templates & Reports",
    description: "Save reusable email/SMS templates and generate detailed reports on pipeline performance, team activity, and ROI metrics.",
    icon: ClipboardList,
    navHint: "/dashboard/reports",
  },
  {
    title: "Settings & Communication",
    description: "Connect your own email (SMTP) to send from your business address. Verify your phone number for caller ID masking. Manage integrations and API keys.",
    icon: Settings,
    navHint: "/dashboard/settings",
  },
  {
    title: "You're All Set! 🚀",
    description: "You're ready to start building your sales pipeline. Begin by finding prospects with Brivano Scout, or import your existing leads to get started.",
    icon: CheckCircle,
    tip: "Pro tip: Start with the Scout to find prospects, then enroll them into a campaign.",
  },
];

const TOUR_STORAGE_KEY = "brivano_onboarding_complete";

interface OnboardingTourProps {
  forceShow?: boolean;
}

const OnboardingTour = ({ forceShow = false }: OnboardingTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      setCurrentStep(0);
      return;
    }
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      // Small delay so dashboard renders first
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const completeTour = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setIsVisible(false);
  };

  const skipTour = () => {
    completeTour();
  };

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;
  const isFirst = currentStep === 0;
  const isLast = currentStep === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={skipTour} />

      {/* Tour Card */}
      <Card className="relative z-10 w-full max-w-md mx-4 border-border/60 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <CardContent className="p-0">
          {/* Header with icon */}
          <div className="relative p-6 pb-4">
            {/* Skip button */}
            <button
              onClick={skipTour}
              className="absolute top-4 right-4 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Step counter */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Step {currentStep + 1} of {tourSteps.length}
              </span>
            </div>

            {/* Icon */}
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <step.icon className="h-6 w-6 text-primary" />
            </div>

            {/* Title & Description */}
            <h3 className="text-lg font-semibold tracking-tight mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

            {/* Tip */}
            {step.tip && (
              <div className="mt-3 p-3 rounded-lg bg-primary/[0.05] border border-primary/10">
                <p className="text-xs text-primary font-medium">💡 {step.tip}</p>
              </div>
            )}
          </div>

          {/* Progress & Actions */}
          <div className="px-6 pb-6 space-y-4">
            <Progress value={progress} className="h-1" />

            <div className="flex items-center justify-between">
              <div>
                {!isFirst ? (
                  <Button variant="ghost" size="sm" onClick={prevStep} className="gap-1 text-xs h-8">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={skipTour} className="text-xs h-8 text-muted-foreground">
                    Skip Tour
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {step.navHint && !isFirst && !isLast && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1"
                    onClick={() => {
                      completeTour();
                      navigate(step.navHint!);
                    }}
                  >
                    Go There <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
                <Button size="sm" onClick={nextStep} className="text-xs h-8 gap-1">
                  {isLast ? (
                    <>Get Started <Rocket className="h-3.5 w-3.5" /></>
                  ) : (
                    <>Next <ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingTour;
