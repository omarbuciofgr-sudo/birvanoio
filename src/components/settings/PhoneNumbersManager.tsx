import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, Plus, Trash2, Loader2, RefreshCw, Info, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface PhoneNumber {
  id: string;
  phone_number: string;
  label: string;
  verification_status: string;
  twilio_validation_code: string | null;
  is_default: boolean;
  verified_at: string | null;
  created_at: string;
}

export const PhoneNumbersManager = ({ userId }: { userId: string }) => {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState<string | null>(null);
  const [validationCode, setValidationCode] = useState<string | null>(null);
  const [form, setForm] = useState({ phone_number: "", label: "Primary" });

  useEffect(() => { fetchNumbers(); }, []);

  const fetchNumbers = async () => {
    const { data, error } = await supabase
      .from("user_phone_numbers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");

    if (!error && data) setNumbers(data);
    setIsLoading(false);
  };

  const handleStartVerification = async () => {
    if (!form.phone_number) {
      toast.error("Please enter a phone number");
      return;
    }
    setIsSaving(true);
    setValidationCode(null);

    const { data, error } = await supabase.functions.invoke("verify-caller-id", {
      body: { action: "start_verification", phoneNumber: form.phone_number, label: form.label },
    });

    if (error || !data?.success) {
      toast.error(data?.error || "Failed to start verification");
    } else {
      setValidationCode(data.validationCode?.toString());
      toast.success("Verification call initiated! Answer your phone.");
      fetchNumbers();
    }
    setIsSaving(false);
  };

  const handleCheckStatus = async (id: string) => {
    setIsChecking(id);
    const { data, error } = await supabase.functions.invoke("verify-caller-id", {
      body: { action: "check_status", phoneNumberId: id },
    });

    if (!error && data?.verified) {
      toast.success("Phone number verified!");
      fetchNumbers();
    } else {
      toast.info("Not yet verified. Please complete the verification call.");
    }
    setIsChecking(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("user_phone_numbers").delete().eq("id", id);
    if (!error) {
      toast.success("Phone number removed");
      fetchNumbers();
    }
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from("user_phone_numbers").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("user_phone_numbers").update({ is_default: true }).eq("id", id);
    toast.success("Default caller ID updated");
    fetchNumbers();
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading phone numbers...</div>;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Caller ID Numbers
            </CardTitle>
            <CardDescription>Verify your personal/business number to display as caller ID when contacting leads.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setValidationCode(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Number
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Verify Phone Number</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Phone Number</label>
                  <Input
                    value={form.phone_number}
                    onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                    placeholder="+15551234567"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Enter in E.164 format (e.g., +15551234567)</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Label</label>
                  <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g., Office" className="mt-1" />
                </div>

                {validationCode ? (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                    <p className="text-sm font-medium text-foreground mb-2">Your Validation Code:</p>
                    <p className="text-3xl font-bold text-primary tracking-widest">{validationCode}</p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Answer the call from Twilio and enter this code when prompted. Then click "Check Status" below.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/30 border border-border">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      We'll place an automated call to your phone. When you answer, you'll be asked to enter a verification code. This confirms you own the number.
                    </p>
                  </div>
                )}

                <Button onClick={handleStartVerification} disabled={isSaving} className="w-full">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Calling...</> : validationCode ? "Resend Verification Call" : "Start Verification Call"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {numbers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No phone numbers added yet.</p>
            <p className="text-xs mt-1">Add and verify your number to use it as caller ID.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {numbers.map(num => (
              <div key={num.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{num.phone_number}</p>
                    <p className="text-xs text-muted-foreground">{num.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {num.verification_status === "verified" ? (
                    <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleCheckStatus(num.id)} disabled={isChecking === num.id}>
                      {isChecking === num.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Check Status
                    </Button>
                  )}
                  {num.is_default ? (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  ) : num.verification_status === "verified" ? (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleSetDefault(num.id)}>Set Default</Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(num.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
