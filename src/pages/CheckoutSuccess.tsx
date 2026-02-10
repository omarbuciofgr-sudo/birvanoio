import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, LayoutDashboard } from "lucide-react";
import brivanoLogo from "@/assets/logo-min-4.png";

const CheckoutSuccess = () => {
  useEffect(() => {
    // Clear any checkout-related state if needed
    document.title = "Welcome to Brivano! - Subscription Confirmed";
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <Link to="/" className="inline-block mb-8">
          <img src={brivanoLogo} alt="Brivano" className="h-16 w-auto mx-auto mix-blend-multiply dark:hidden" />
          <span className="hidden dark:inline text-2xl font-semibold tracking-tight font-display text-foreground">brivano</span>
        </Link>

        {/* Success Icon */}
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>

        {/* Message */}
        <h1 className="font-display text-3xl font-bold text-foreground mb-4">
          Welcome to Brivano!
        </h1>
        <p className="text-muted-foreground mb-8">
          Your subscription is now active. You'll receive a confirmation email shortly 
          with your account details and next steps.
        </p>

        {/* What's Next */}
        <div className="p-6 rounded-xl bg-card border border-border mb-8 text-left">
          <h3 className="font-semibold text-foreground mb-4">What happens next?</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Check your email for your account setup instructions
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Complete your profile and set your lead preferences
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Your first batch of leads will be delivered within 24-48 hours
              </span>
            </li>
          </ul>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/dashboard">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              Back to Home
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
