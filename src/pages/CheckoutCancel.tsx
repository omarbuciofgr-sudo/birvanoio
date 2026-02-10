import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, MessageSquare } from "lucide-react";
import brivanoLogo from "@/assets/logo-min-4.png";

const CheckoutCancel = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <Link to="/" className="inline-block mb-8">
          <img src={brivanoLogo} alt="Brivano" className="h-16 w-auto mx-auto mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert" />
        </Link>

        {/* Cancel Icon */}
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-muted-foreground" />
        </div>

        {/* Message */}
        <h1 className="font-display text-3xl font-bold text-foreground mb-4">
          Checkout Cancelled
        </h1>
        <p className="text-muted-foreground mb-8">
          No worries! Your checkout was cancelled and you haven't been charged. 
          If you have any questions, we're here to help.
        </p>

        {/* Help Section */}
        <div className="p-6 rounded-xl bg-card border border-border mb-8 text-left">
          <h3 className="font-semibold text-foreground mb-3">Need help deciding?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Not sure which plan is right for you? We can send you 10 free sample leads 
            for your target market so you can see the quality firsthand.
          </p>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
            asChild
          >
            <Link to="/#contact">
              <MessageSquare className="w-4 h-4 mr-2" />
              Get 10 Free Sample Leads
            </Link>
          </Button>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <Button 
            asChild 
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/#pricing">
              View Plans Again
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutCancel;
