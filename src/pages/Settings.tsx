import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { Phone, Mail, Info, User, Zap, MessageSquare, Clock, Send, RotateCcw } from "lucide-react";
import { WebhookIntegrations } from "@/components/integrations/WebhookIntegrations";
import { MessageTemplatesLibrary } from "@/components/templates/MessageTemplatesLibrary";
import { ScheduledMessages } from "@/components/scheduling/ScheduledMessages";
import { EmailAccountsManager } from "@/components/settings/EmailAccountsManager";
import { PhoneNumbersManager } from "@/components/settings/PhoneNumbersManager";

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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your account and integrations</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="h-9 p-0.5 bg-muted/60">
            <TabsTrigger value="profile" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <User className="w-3.5 h-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <MessageSquare className="w-3.5 h-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="communication" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Send className="w-3.5 h-3.5" />
              Communication
            </TabsTrigger>
            <TabsTrigger value="integrations" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Zap className="w-3.5 h-3.5" />
              Integrations
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6 max-w-2xl">
            {/* Profile Settings */}
            <Card className="border-border/60">
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

            {/* Restart Onboarding Tour */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-foreground">Onboarding Tour</CardTitle>
                <CardDescription>Revisit the guided tour to learn about all platform features.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="gap-2 text-xs"
                  onClick={() => {
                    localStorage.removeItem("brivano_onboarding_complete");
                    toast.success("Tour reset! Navigate to the Dashboard to start the tour.");
                    navigate("/dashboard");
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restart Tour
                </Button>
              </CardContent>
            </Card>

            {/* Communication Settings */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Communication Settings
                </CardTitle>
                <CardDescription>
                  Set up your personal phone number and email so leads see your contact info when you reach out.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Personal Phone Number */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Your Phone Number
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
                      Enter your personal or business phone number in international format (e.g., +15551234567 for US, +447911123456 for UK). 
                      This number will appear as the caller ID when you call or text leads — perfect for realtors and professionals who want leads to recognize them.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Sender Email */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Your Email Address
                  </label>
                  <Input
                    value={profile.sender_email}
                    onChange={(e) => setProfile({ ...profile, sender_email: e.target.value })}
                    placeholder="you@yourdomain.com"
                    className="bg-secondary/50 border-border"
                  />
                  <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/30 border border-border">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Enter your personal or business email address. Leads will see this as the sender when you email them, 
                      building trust and brand recognition. Domain verification may be required for deliverability.
                    </p>
                  </div>
                </div>

                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Communication Settings"}
                </Button>
              </CardContent>
            </Card>

            {/* Subscription Info */}
            <Card className="border-border/60">
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
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <MessageTemplatesLibrary userId={user.id} />
          </TabsContent>

          {/* Scheduled Tab */}
          <TabsContent value="scheduled">
            <ScheduledMessages userId={user.id} />
          </TabsContent>

          {/* Communication Tab */}
          <TabsContent value="communication" className="space-y-6 max-w-2xl">
            <EmailAccountsManager userId={user.id} />
            <PhoneNumbersManager userId={user.id} />
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <WebhookIntegrations userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
