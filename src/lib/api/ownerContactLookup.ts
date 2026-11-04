import { supabase } from '@/integrations/supabase/client';
import { refreshOwnerLookups } from '@/hooks/useOwnerLookups';
import type { RentCastListing } from './rentcastApi';

export async function findOwnerContact(listingId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('tracerfy-skip-trace', { body: { listingId } });
    if (error) throw new Error('Contact lookup is temporarily unavailable. Please try again.');
    if (!data?.success) throw new Error(data?.error || 'Contact lookup is temporarily unavailable.');
    return data as { success: boolean; matched: boolean; listing: RentCastListing; credits_spent: number; message: string };
  } finally { refreshOwnerLookups(); }
}