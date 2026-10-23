import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleLabels, type PlaybookRole } from "@/data/playbookContent";
import { PLAYBOOK_ROLES } from "@/lib/playbook";
import type { ProspectingProfile } from "@/hooks/useProspectingProfile";

type Props = {
  profile: ProspectingProfile | null;
  save: (p: { prospecting_role?: PlaybookRole; company_name?: string; phone?: string }) => Promise<{ error: string | null }>;
};

/** Pick a prospecting role; asks for company and phone only when they are missing. */
export function RoleSetupCard({ profile, save }: Props) {
  const [role, setRole] = useState<PlaybookRole | "">(profile?.prospecting_role ?? "");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setRole(profile?.prospecting_role ?? ""), [profile?.prospecting_role]);
  const needCompany = !profile?.brokerage?.trim() && !profile?.company_name?.trim();
  const needPhone = !profile?.phone?.trim();
  const isNew = !profile?.prospecting_role;

  const submit = async (nextRole = role) => {
    if (!nextRole) return;
    setSaving(true);
    const { error } = await save({
      prospecting_role: nextRole as PlaybookRole,
      ...(needCompany && company.trim() ? { company_name: company.trim().slice(0, 200) } : {}),
      ...(needPhone && phone.trim() ? { phone: phone.trim().slice(0, 20) } : {}),
    });
    setSaving(false);
    if (error) toast.error(error); else toast.success("Saved");
  };

  if (!isNew) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Your role:</span>
        <Select value={role || undefined} onValueChange={(v) => { setRole(v as PlaybookRole); submit(v as PlaybookRole); }}>
          <SelectTrigger className="h-11 w-56 md:h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{PLAYBOOK_ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
      <div>
        <p className="font-medium">How do you prospect?</p>
        <p className="text-sm text-muted-foreground">We'll show the scripts that fit you first and fill in your details.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PLAYBOOK_ROLES.map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)}
            className={`min-h-11 rounded-md border p-3 text-left text-sm ${role === r ? "border-primary bg-primary/[0.08]" : "border-border hover:bg-muted/50"}`}>
            {roleLabels[r]}
          </button>
        ))}
      </div>
      {(needCompany || needPhone) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {needCompany && <Input className="h-11" placeholder="Company or brokerage" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} />}
          {needPhone && <Input className="h-11" placeholder="Your phone number" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />}
        </div>
      )}
      <Button className="min-h-11" disabled={!role || saving} onClick={() => submit()}>{saving ? "Saving..." : "Save"}</Button>
    </div>
  );
}
