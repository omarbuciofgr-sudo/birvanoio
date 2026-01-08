import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { z } from "zod";
import { Phone, Mail, Info } from "lucide-react";

// E.164 phone number validation (optional field)
const e164Regex = /^\+[1-9]\d{1,14}$/;

const profileSchema = z.object({
  first_name: z.string().trim().max(100, "First name must be less than 100 characters").optional().or(z.literal("")),
  last_name: z.string().trim().max(100, "Last name must be less than 100 characters").optional().or(z.literal("")),
  company_name: z.string().trim().max(200, "Company name must be less than 200 characters").optional().or(z.literal("")),
  twilio_phone_number: z.string().trim()
    .refine((val) => val === "" || e164Regex.test(val), {
      message: "Phone number must be in E.164 format (e.g., +15551234567)"
    })
    .optional()
    .or(z.literal("")),
  sender_email: z.string().trim()
    .refine((val) => val === "" || z.string().email().safeParse(val).success, {
      message: "Must be a valid email address"
    })
    .optional()
    .or(z.literal("")),
});

const Settings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    twilio_phone_number: "",
    sender_email: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name, last_name, company_name, twilio_phone_number, sender_email")
      .eq("user_id", user?.id)
      .single();

    if (!error && data) {
      setProfile({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        company_name: data.company_name || "",
        twilio_phone_number: data.twilio_phone_number || "",
        sender_email: data.sender_email || "",
      });
    }
  };

  const handleSave = async () => {
    // Validate profile data before submitting
    const validation = profileSchema.safeParse(profile);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name.trim() || null,
        last_name: profile.last_name.trim() || null,
        company_name: profile.company_name.trim() || null,
        twilio_phone_number: profile.twilio_phone_number.trim() || null,
        sender_email: profile.sender_email.trim() || null,
      })
      .eq("user_id", user?.id);

    if (error) {
      toast.error("Failed to save profile. Please try again.");
    } else {
      toast.success("Profile updated!");
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences.</p>
        </div>

        {/* Profile Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  First Name
                </label>
                <Input
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Last Name
                </label>
                <Input
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Company Name
              </label>
              <Input
                value={profile.company_name}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                placeholder="Your company name"
                className="bg-secondary/50 border-border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <Input
                value={user.email || ""}
                disabled
                className="bg-secondary/50 border-border opacity-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Contact support to change your email address.
              </p>
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Communication Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Communication Settings
            </CardTitle>
            <CardDescription>
              Configure your outbound phone number and email address for contacting leads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Twilio Phone Number */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Your Twilio Phone Number
              </label>
              <Input
                value={profile.twilio_phone_number}
                onChange={(e) => setProfile({ ...profile, twilio_phone_number: e.target.value })}
                placeholder="+15551234567"
                className="bg-secondary/50 border-border"
              />
              <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/30 border border-border">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Enter your Twilio phone number in E.164 format (e.g., +15551234567). 
                  This number will be used as the caller ID for outbound calls and SMS. 
                  If not configured, the default system number will be used.
                </p>
              </div>
            </div>

            <Separator />

            {/* Sender Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Your Sender Email
              </label>
              <Input
                value={profile.sender_email}
                onChange={(e) => setProfile({ ...profile, sender_email: e.target.value })}
                placeholder="sales@yourcompany.com"
                className="bg-secondary/50 border-border"
              />
              <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/30 border border-border">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Enter your verified sender email address. This email must be verified with Resend 
                  (your email provider) before it can be used. If not configured, emails will be 
                  sent from the default system address.
                </p>
              </div>
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Communication Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Subscription Info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Subscription</CardTitle>
            <CardDescription>Your current plan and billing information.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-foreground">Current Plan</p>
                <p className="text-sm text-muted-foreground">
                  Contact us to upgrade or manage your subscription.
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="mailto:hello@brivano.io">Contact Support</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
