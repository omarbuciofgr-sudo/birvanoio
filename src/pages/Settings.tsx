import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

const Settings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
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
      .select("first_name, last_name, company_name")
      .eq("user_id", user?.id)
      .single();

    if (!error && data) {
      setProfile({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        company_name: data.company_name || "",
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("user_id", user?.id);

    if (error) {
      toast.error("Failed to save profile");
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
