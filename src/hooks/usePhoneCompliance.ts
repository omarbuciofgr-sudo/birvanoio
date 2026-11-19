import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchPhoneChecks, normalizeUsPhone, type PhoneCheck } from '@/lib/phoneCompliance';

let activeUser: string | null | undefined;
const listeners = new Set<() => void>();
supabase.auth.onAuthStateChange((_event, session) => {
  const user = session?.user.id ?? null;
  if (user === activeUser) return;
  activeUser = user;
  listeners.forEach(listener => listener());
});
const getUser = () => activeUser;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

type Pending = { phone: string; userId: string; resolve: (value: PhoneCheck | null) => void; reject: (error: unknown) => void };
let waiting: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function queuePhoneCheck(phone: string, userId: string) {
  return new Promise<PhoneCheck | null>((resolve, reject) => {
    waiting.push({ phone, userId, resolve, reject });
    timer ??= setTimeout(() => {
      const user = activeUser;
      const pending = waiting.filter(item => item.userId === user);
      for (const item of waiting) if (item.userId !== user) item.reject(new Error('Session changed'));
      timer = undefined;
      waiting = [];
      if (!pending.length) return;
      void fetchPhoneChecks(pending.map(item => item.phone)).then(
        checks => pending.forEach(item => item.userId === activeUser ? item.resolve(checks[item.phone] ?? null) : item.reject(new Error('Session changed'))),
        error => pending.forEach(item => item.reject(error)),
      );
    }, 25);
  });
}

export function usePhoneCompliance(value?: string | null) {
  const phone = normalizeUsPhone(value);
  const userId = useSyncExternalStore(subscribe, getUser, getUser);
  const query = useQuery({
    queryKey: ['phone-compliance', userId, phone],
    queryFn: () => phone && userId ? queuePhoneCheck(phone, userId) : null,
    enabled: !!phone && !!userId,
    retry: false,
    staleTime: 0,
  });
  return { check: query.data ?? undefined, pending: !!phone && query.isPending && userId !== null, unavailable: !!phone && (query.isError || userId === null) };
}