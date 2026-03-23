import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Sparkles } from "lucide-react";

interface SampleLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SampleLeadsModal = ({ open, onOpenChange }: SampleLeadsModalProps) => {
  const [formData, setFormData] = useState({
    email: "",
    niche: "",
    location: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    toast.success("Check your inbox! We're sending 10 sample leads your way.");
    setFormData({ email: "", niche: "", location: "" });
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-display">Get 10 Free Sample Leads</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tell us your niche and we'll send verified B2B leads straight to your inbox.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Work Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="you@company.com"
              required
              className="bg-secondary/50 border-border"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Your Niche
            </label>
            <Input
              value={formData.niche}
              onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
              placeholder="e.g., Roofing contractors, Dental clinics..."
              required
              className="bg-secondary/50 border-border"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Target Location
            </label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Austin, TX or California"
              required
              className="bg-secondary/50 border-border"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Sending..."
            ) : (
              <>
                Send Me Sample Leads
                <Send className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            No spam. Unsubscribe anytime. Your data is secure.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SampleLeadsModal;
