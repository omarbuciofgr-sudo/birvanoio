import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppLead = Database["public"]["Tables"]["leads"]["Row"];

export const leadsQueryKey = ["app-leads"] as const;

export function useLeadsData(enabled = true) {
  return useQuery({
    queryKey: leadsQueryKey,
    enabled,
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