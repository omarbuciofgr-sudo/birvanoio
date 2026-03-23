import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmailAccount {
  id: string;
  label: string;
  email_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  use_tls: boolean;
  is_default: boolean;
  is_verified: boolean;
  last_used_at: string | null;
  created_at: string;
}

const SMTP_PRESETS: Record<string, { host: string; port: number; tls: boolean }> = {
  gmail: { host: "smtp.gmail.com", port: 587, tls: true },
  outlook: { host: "smtp.office365.com", port: 587, tls: true },
  yahoo: { host: "smtp.mail.yahoo.com", port: 587, tls: true },
  custom: { host: "", port: 587, tls: true },
};

export const EmailAccountsManager = ({ userId }: { userId: string }) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [preset, setPreset] = useState("gmail");
  const [form, setForm] = useState({
    label: "Primary",
    email_address: "",
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    use_tls: true,
  });

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("user_email_accounts")
      .select("id, label, email_address, smtp_host, smtp_port, smtp_username, use_tls, is_default, is_verified, last_used_at, created_at")
      .eq("user_id", userId)
      .order("created_at");

    if (!error && data) setAccounts(data);
    setIsLoading(false);
  };

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const p = SMTP_PRESETS[value];
    setForm(f => ({ ...f, smtp_host: p.host, smtp_port: p.port, use_tls: p.tls }));
  };

  const handleAdd = async () => {
    if (!form.email_address || !form.smtp_host || !form.smtp_username || !form.smtp_password) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Authentication required");
        setIsSaving(false);
        return;
      }

      const response = await supabase.functions.invoke("manage-email-account", {
        body: {
          action: "create",
          label: form.label,
          email_address: form.email_address,
          smtp_host: form.smtp_host,
          smtp_port: form.smtp_port,
          smtp_username: form.smtp_username,
          smtp_password: form.smtp_password,
          use_tls: form.use_tls,
        },
      });

      if (response.error || !response.data?.success) {
        toast.error(response.data?.error || "Failed to add email account");
      } else {
        toast.success("Email account added!");
        setIsDialogOpen(false);
        setForm({ label: "Primary", email_address: "", smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_username: "", smtp_password: "", use_tls: true });
        fetchAccounts();
      }
    } catch (err) {
      toast.error("Failed to add email account");
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("user_email_accounts").delete().eq("id", id);
    if (!error) {
      toast.success("Email account removed");
      fetchAccounts();
    }
  };

  const handleSetDefault = async (id: string) => {
    // Unset all defaults first
    await supabase.from("user_email_accounts").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("user_email_accounts").update({ is_default: true }).eq("id", id);
    toast.success("Default email updated");
    fetchAccounts();
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading email accounts...</div>;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Accounts (SMTP)
            </CardTitle>
            <CardDescription>Send emails from your own email address using your mail server.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Email Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Provider</label>
                  <Select value={preset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail</SelectItem>
                      <SelectItem value="outlook">Outlook / Office 365</SelectItem>
                      <SelectItem value="yahoo">Yahoo</SelectItem>
                      <SelectItem value="custom">Custom SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Label</label>
                  <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g., Work Email" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Email Address</label>
                  <Input value={form.email_address} onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))} placeholder="you@example.com" className="mt-1" />
                </div>
                {preset === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-foreground">SMTP Host</label>
                      <Input value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Port</label>
                      <Input type="number" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) }))} className="mt-1" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground">Username</label>
                  <Input value={form.smtp_username} onChange={e => setForm(f => ({ ...f, smtp_username: e.target.value }))} placeholder="Usually your email address" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Password / App Password</label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.smtp_password}
                      onChange={e => setForm(f => ({ ...f, smtp_password: e.target.value }))}
                      placeholder="App-specific password recommended"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {preset === "gmail" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      For Gmail, use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" className="underline text-primary">App Password</a> instead of your regular password.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.use_tls} onCheckedChange={v => setForm(f => ({ ...f, use_tls: v }))} />
                  <span className="text-sm text-foreground">Use TLS encryption</span>
                </div>
                <Button onClick={handleAdd} disabled={isSaving} className="w-full">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : "Add Email Account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No email accounts configured yet.</p>
            <p className="text-xs mt-1">Add your Gmail, Outlook, or custom SMTP to send emails from your own address.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map(account => (
              <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{account.email_address}</p>
                    <p className="text-xs text-muted-foreground">{account.label} · {account.smtp_host}:{account.smtp_port}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.is_default ? (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleSetDefault(account.id)}>Set Default</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(account.id)}>
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
