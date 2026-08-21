import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { allowedNavHrefs, ALWAYS_VISIBLE_NAV } from "@/lib/persona";
import { trackPersonaEvent } from "@/lib/analytics/personaAnalytics";

export type PersonaState = {
  role: string | null;
  goals: string[];
  completedAt: string | null;
};

const EMPTY: PersonaState = { role: null, goals: [], completedAt: null };

/**
 * Module-level cache so the sidebar keeps the same allowed-nav set when a route
 * remounts the layout. Without it, every tab switch briefly rendered the full
 * (unfiltered) nav while the profile query was in flight.
 */
const personaCache = new Map<string, PersonaState>();
const CACHE_KEY = "brivano:persona";

function readCachedPersona(userId?: string | null): PersonaState | null {
  if (!userId) return null;
  const inMemory = personaCache.get(userId);
  if (inMemory) return inMemory;
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY}:${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as PersonaState;
      personaCache.set(userId, parsed);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedPersona(userId: string, state: PersonaState) {
  personaCache.set(userId, state);
  try {
    window.localStorage.setItem(`${CACHE_KEY}:${userId}`, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

// Internal accounts that always see every tool and skip persona setup.
const FULL_ACCESS_EMAILS = ["info@brivano.io"];

export const usePersona = () => {
  const { user, loading: authLoading } = useAuth();
  const [persona, setPersona] = useState<PersonaState>(
    () => readCachedPersona(user?.id) ?? EMPTY,
  );
  const [loading, setLoading] = useState(() => !readCachedPersona(user?.id));
  const hasFullAccess = FULL_ACCESS_EMAILS.includes(
    (user?.email ?? "").trim().toLowerCase(),
  );


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

    const next: PersonaState = {
      role: (data as any)?.persona_role ?? null,
      goals: ((data as any)?.persona_goals as string[] | null) ?? [],
      completedAt: (data as any)?.persona_completed_at ?? null,
    };
    writeCachedPersona(user.id, next);
    setPersona(next);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    const cached = readCachedPersona(user?.id);
    if (cached) {
      setPersona(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    refresh();
  }, [authLoading, refresh, user?.id]);

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
        const next: PersonaState = { role, goals, completedAt: new Date().toISOString() };
        writeCachedPersona(user.id, next);
        setPersona(next);
        trackPersonaEvent("persona_selected", {
          role,
          goals,
          metadata: { previous_role: previousRole, changed: previousRole !== role },
        });
      }
      return { error };
    },
    [user?.id, persona.role],
  );

  return {
    persona,
    loading: loading || authLoading,
    savePersona,
    refresh,
    needsSetup:
      !hasFullAccess && !loading && !authLoading && !!user && !persona.completedAt,
    isRealtor: !hasFullAccess && persona.role === "realtor",
    // null = no restriction (every nav item visible)
    allowedNav: hasFullAccess
      ? null
      : loading && !persona.completedAt
        ? new Set(ALWAYS_VISIBLE_NAV)
        : allowedNavHrefs(persona.role, persona.goals),
  };
};

