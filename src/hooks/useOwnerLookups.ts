import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function refreshOwnerLookups() { window.dispatchEvent(new Event('owner-lookup-completed')); }

export function useOwnerLookups() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, isFree: false, total: 5, remaining: 0, attempted: false });
  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('my_owner_lookup_allowance');
    if (error || !data) return;
    const value = data as { is_free: boolean; total: number; used: number; attempted: boolean };
    setState({ loading: false, isFree: value.is_free, total: value.total, remaining: Math.max(0, value.total - value.used), attempted: value.attempted });
  }, [user?.id]);
  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    window.addEventListener('owner-lookup-completed', update);
    window.addEventListener('focus', update);
    return () => { window.removeEventListener('owner-lookup-completed', update); window.removeEventListener('focus', update); };
  }, [refresh]);
  return { ...state, refresh };
}