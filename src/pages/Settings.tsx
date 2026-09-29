import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentPhotoField } from "@/components/settings/AgentPhotoField";
import { useSubscription } from "@/contexts/SubscriptionContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { Phone, Mail, Info, User, Zap, MessageSquare, Clock, Send, RotateCcw, AlertCircle, Play } from "lucide-react";
import { WebhookIntegrations } from "@/components/integrations/WebhookIntegrations";
import GoogleCalendarCard from "@/components/settings/GoogleCalendarCard";
import GmailCard from "@/components/settings/GmailCard";
import ContactGuardCard from "@/components/settings/ContactGuardCard";
import { MessageTemplatesLibrary } from "@/components/templates/MessageTemplatesLibrary";
import { ScheduledMessages } from "@/components/scheduling/ScheduledMessages";
import { EmailAccountsManager } from "@/components/settings/EmailAccountsManager";
import { PhoneNumbersManager } from "@/components/settings/PhoneNumbersManager";
import { WorkspaceFocusCard } from "@/components/settings/WorkspaceFocusCard";
import DataPageSkeleton from "@/components/dashboard/DataPageSkeleton";
import { DailyGoalsSettingsCard } from "@/components/settings/DailyGoalsSettingsCard";
import { usePersona } from "@/hooks/usePersona";

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
  mailing_address: z.string().trim().max(500, "Mailing address must be less than 500 characters").optional().or(z.literal("")),
});

const Settings = () => {
  const { user, loading } = useAuth();
  const { workspaceId, workspaceRole } = useSubscription();
  const { isRealtor } = usePersona();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    twilio_phone_number: "",
    sender_email: "",
    mailing_address: "",
  });
  const [workspaceMailingAddress, setWorkspaceMailingAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [brokerage, setBrokerage] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentPhotoPath, setAgentPhotoPath] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, workspaceId]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name, last_name, company_name, twilio_phone_number, sender_email, mailing_address, brokerage, phone, agent_photo_path")
      .eq("user_id", user?.id)
      .maybeSingle();

    if (!error && data) {
      setProfile({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        company_name: data.company_name || "",
        twilio_phone_number: data.twilio_phone_number || "",
        sender_email: data.sender_email || "",
        mailing_address: data.mailing_address || "",
      });
      setBrokerage(data.brokerage || "");
      setAgentPhone(data.phone || "");
      setAgentPhotoPath(data.agent_photo_path || null);
    }
    if (workspaceId) {
      const { data: settings } = await supabase.from("workspace_settings").select("mailing_address").eq("workspace_id", workspaceId).maybeSingle();
      setWorkspaceMailingAddress(settings?.mailing_address || "");
    }
    setProfileLoading(false);
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
      mailing_address: profile.mailing_address.trim() || null,
        brokerage: brokerage.trim().slice(0, 200) || null,
        phone: agentPhone.trim().slice(0, 40) || null,
      })
      .eq("user_id", user?.id);

    if (error) {
      toast.error("Failed to save profile. Please try again.");
    } else {
      toast.success("Profile updated!");
    }
    setIsSaving(false);
  };

  const saveWorkspaceAddress = async () => {
    if (!workspaceId) return;
    setIsSaving(true);
    const { error } = await supabase.from("workspace_settings").update({ mailing_address: workspaceMailingAddress.trim() || null }).eq("workspace_id", workspaceId);
    setIsSaving(false);
    if (error) toast.error("Failed to save workspace mailing address");
    else toast.success("Workspace mailing address saved");
  };

  if (loading || (user && profileLoading)) return <DataPageSkeleton />;

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
          <TabsList className="flex h-11 w-full justify-start overflow-x-auto p-0.5 bg-muted/60 sm:h-9 sm:w-auto">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Report branding</p>
                    <p className="text-xs text-muted-foreground">Shown on the market reports you create for owners.</p>
                  </div>
                  <AgentPhotoField userId={user.id} path={agentPhotoPath} onChange={setAgentPhotoPath} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Brokerage</label>
                      <Input value={brokerage} onChange={(e) => setBrokerage(e.target.value)} placeholder="e.g. Keller Williams Naperville" maxLength={200} className="bg-secondary/50 border-border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Phone</label>
                      <Input value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} placeholder="(555) 123-4567" maxLength={40} className="bg-secondary/50 border-border" />
                    </div>
                  </div>
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

            <WorkspaceFocusCard />

            {isRealtor && <DailyGoalsSettingsCard userId={user.id} />}

            {/* Restart / Resume Onboarding Tour */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Onboarding Tour
                </CardTitle>
                <CardDescription>Revisit the guided tour or recover if it gets stuck.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="gap-2 text-xs"
                    onClick={() => {
                      localStorage.removeItem("brivano_onboarding_complete");
                      localStorage.removeItem("brivano_onboarding_step");
                      toast.success("Tour reset! It will start from the beginning on the Dashboard.");
                      navigate("/dashboard");
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset tour
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-xs"
                    onClick={() => {
                      localStorage.removeItem("brivano_onboarding_complete");
                      const savedStep = localStorage.getItem("brivano_onboarding_step");
                      if (!savedStep) {
                        toast.info("No saved step found. The tour will start from the beginning.");
                      } else {
                        toast.success(`Tour resumed from step ${parseInt(savedStep, 10) + 1}.`);
                      }
                      navigate("/dashboard");
                    }}
                  >
                    <Play className="h-3.5 w-3.5" /> Reopen last step
                  </Button>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-400/90">
                    Onboarding stuck? Press <kbd className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-900/50 font-mono text-[10px]">Esc</kbd> inside the tour to close it, or use <strong>Reset tour</strong> to start over.
                  </p>
                </div>
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

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Your mailing address (optional override)</label>
                  <Textarea value={profile.mailing_address} onChange={(e) => setProfile({ ...profile, mailing_address: e.target.value })} placeholder="Street address, PO box, or registered private mailbox" rows={3} />
                  <p className="text-xs text-muted-foreground">Used in your campaign email footer instead of the workspace address.</p>
                </div>

                {workspaceRole === "owner" && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <label className="block text-sm font-medium text-foreground">Workspace mailing address</label>
                    <Textarea value={workspaceMailingAddress} onChange={(e) => setWorkspaceMailingAddress(e.target.value)} placeholder="Street address, PO box, or registered private mailbox" rows={3} />
                    <Button type="button" variant="outline" onClick={saveWorkspaceAddress} disabled={isSaving}>Save workspace address</Button>
                  </div>
                )}

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
            <GoogleCalendarCard />
            <GmailCard />
            <ContactGuardCard />
            <WebhookIntegrations userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
