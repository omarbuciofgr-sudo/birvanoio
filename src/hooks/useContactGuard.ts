import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ContactValueType = "phone" | "email";

export type SuppressionEntry = {
  id: string;
  value_type: ContactValueType;
  value_normalized: string;
  reason: string | null;
  source: string;
  created_at: string;
};

export type ContactTouch = {
  id: string;
  user_id: string;
  channel: string;
  contact_name: string | null;
  created_at: string;
};

export type ContactCheck = {
  /** On the do-not-contact list. */
  suppressed: boolean;
  suppressionReason: string | null;
  /** Most recent touch logged by anyone in the workspace. */
  lastTouch: ContactTouch | null;
  /** Last touch was by another teammate. */
  duplicateByTeammate: boolean;
  totalTouches: number;
};

export const EMPTY_CHECK: ContactCheck = {
  suppressed: false,
  suppressionReason: null,
  lastTouch: null,
  duplicateByTeammate: false,
  totalTouches: 0,
};

export function normalizeContactValue(value: string, type: ContactValueType): string {
  const v = (value || "").trim();
  if (!v) return "";
  if (type === "email") return v.toLowerCase();
  const digits = v.replace(/[^0-9]/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function detectContactType(value: string): ContactValueType {
  return value.includes("@") ? "email" : "phone";
}

/**
 * Workspace-wide duplicate-contact and do-not-contact guard.
 * Suppression list and contact history are shared by every workspace member.
 */
export function useContactGuard() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cache = useRef(new Map<string, ContactCheck>());

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("workspace_memberships")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setWorkspaceId(data?.workspace_id ?? null);
      setLoading(false);
    })();
  }, [user]);

  const checkContact = useCallback(
    async (rawValue: string, type?: ContactValueType): Promise<ContactCheck> => {
      const kind = type ?? detectContactType(rawValue);
      const value = normalizeContactValue(rawValue, kind);
      if (!value || !workspaceId) return EMPTY_CHECK;

      const cacheKey = `${kind}:${value}`;
      const cached = cache.current.get(cacheKey);
      if (cached) return cached;

      const [{ data: suppression }, { data: touches }] = await Promise.all([
        supabase
          .from("contact_suppression")
          .select("reason")
          .eq("workspace_id", workspaceId)
          .eq("value_type", kind)
          .eq("value_normalized", value)
          .maybeSingle(),
        supabase
          .from("contact_touches")
          .select("id, user_id, channel, contact_name, created_at")
          .eq("workspace_id", workspaceId)
          .eq("value_type", kind)
          .eq("value_normalized", value)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      const list = (touches as ContactTouch[]) || [];
      const lastTouch = list[0] ?? null;
      const result: ContactCheck = {
        suppressed: !!suppression,
        suppressionReason: suppression?.reason ?? null,
        lastTouch,
        duplicateByTeammate: !!lastTouch && lastTouch.user_id !== user?.id,
        totalTouches: list.length,
      };
      cache.current.set(cacheKey, result);
      return result;
    },
    [workspaceId, user?.id],
  );

  const logTouch = useCallback(
    async (rawValue: string, opts: { channel: string; contactName?: string; type?: ContactValueType }) => {
      const kind = opts.type ?? detectContactType(rawValue);
      const value = normalizeContactValue(rawValue, kind);
      if (!value || !workspaceId || !user) return;
      cache.current.delete(`${kind}:${value}`);
      await supabase.from("contact_touches").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        value_type: kind,
        value_normalized: value,
        channel: opts.channel,
        contact_name: opts.contactName ?? null,
      });
    },
    [workspaceId, user],
  );

  const addSuppression = useCallback(
    async (rawValue: string, reason: string, type?: ContactValueType) => {
      const kind = type ?? detectContactType(rawValue);
      const value = normalizeContactValue(rawValue, kind);
      if (!value || !workspaceId || !user) throw new Error("Enter a valid phone number or email");
      cache.current.delete(`${kind}:${value}`);
      const { error } = await supabase.from("contact_suppression").upsert(
        {
          workspace_id: workspaceId,
          value_type: kind,
          value_normalized: value,
          reason: reason || null,
          source: "manual",
          added_by: user.id,
        },
        { onConflict: "workspace_id,value_type,value_normalized" },
      );
      if (error) throw error;
    },
    [workspaceId, user],
  );

  const listSuppression = useCallback(async (): Promise<SuppressionEntry[]> => {
    if (!workspaceId) return [];
    const { data } = await supabase
      .from("contact_suppression")
      .select("id, value_type, value_normalized, reason, source, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(500);
    return (data as SuppressionEntry[]) || [];
  }, [workspaceId]);

  const removeSuppression = useCallback(async (id: string) => {
    cache.current.clear();
    const { error } = await supabase.from("contact_suppression").delete().eq("id", id);
    if (error) throw error;
  }, []);

  return {
    workspaceId,
    loading,
    checkContact,
    logTouch,
    addSuppression,
    listSuppression,
    removeSuppression,
  };
}
