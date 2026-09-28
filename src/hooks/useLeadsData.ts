import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppLead = Database["public"]["Tables"]["leads"]["Row"];

export const leadsQueryKey = (userId?: string) => ["app-leads", userId] as const;

export function useLeadsData(userId?: string) {
  return useQuery({
    queryKey: leadsQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AppLead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}