import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { asPlaybookRole, type TokenProfile } from "@/lib/playbook";
import type { PlaybookRole } from "@/data/playbookContent";

export type ProspectingProfile = TokenProfile & { prospecting_role: PlaybookRole | null };

/** The signed-in user's prospecting role and the profile fields used to fill script tokens. */
export function useProspectingProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProspectingProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const { data } = await supabase.from("profiles")
      .select("first_name, last_name, brokerage, company_name, phone, home_market, prospecting_role")
      .eq("user_id", user.id).maybeSingle();
    setProfile(data ? { ...data, prospecting_role: asPlaybookRole(data.prospecting_role) } : null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: { prospecting_role?: PlaybookRole; company_name?: string; phone?: string }) => {
    if (!user?.id) return { error: "Please sign in." };
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", user.id);
    if (error) return { error: "Couldn't save. Please try again." };
    setProfile((p) => (p ? { ...p, ...patch } as ProspectingProfile : p));
    return { error: null };
  }, [user?.id]);

  return { profile, loading, save, reload: load };
}
