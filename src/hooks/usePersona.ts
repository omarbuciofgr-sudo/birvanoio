import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { allowedNavHrefs } from "@/lib/persona";
import { trackPersonaEvent } from "@/lib/analytics/personaAnalytics";

export type PersonaState = {
  role: string | null;
  goals: string[];
  completedAt: string | null;
};

const EMPTY: PersonaState = { role: null, goals: [], completedAt: null };

export const usePersona = () => {
  const { user, loading: authLoading } = useAuth();
  const [persona, setPersona] = useState<PersonaState>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setPersona(EMPTY);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("persona_role, persona_goals, persona_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    setPersona({
      role: (data as any)?.persona_role ?? null,
      goals: ((data as any)?.persona_goals as string[] | null) ?? [],
      completedAt: (data as any)?.persona_completed_at ?? null,
    });
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    refresh();
  }, [authLoading, refresh]);

  const savePersona = useCallback(
    async (role: string, goals: string[]) => {
      if (!user?.id) return { error: new Error("Not signed in") };
      const { error } = await supabase
        .from("profiles")
        .update({
          persona_role: role,
          persona_goals: goals,
          persona_completed_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
      if (!error) {
        const previousRole = persona.role;
        setPersona({ role, goals, completedAt: new Date().toISOString() });
        trackPersonaEvent("persona_selected", {
          role,
          goals,
          metadata: { previous_role: previousRole, changed: previousRole !== role },
        });
      }
      return { error };
    },
    [user?.id],
  );

  return {
    persona,
    loading: loading || authLoading,
    savePersona,
    refresh,
    needsSetup: !loading && !authLoading && !!user && !persona.completedAt,
    allowedNav: allowedNavHrefs(persona.role, persona.goals),
  };
};
