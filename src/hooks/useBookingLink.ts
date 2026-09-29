import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const EVENT = "brivano:booking-link";
let cache: { userId: string; url: string | null } | null = null;

export function setBookingLinkCache(userId: string, url: string | null) {
  cache = { userId, url };
  window.dispatchEvent(new Event(EVENT));
}

/** The signed-in user's booking link (Cal.com, Calendly or any scheduling page). */
export function useBookingLink() {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(cache && user && cache.userId === user.id ? cache.url : null);
  const [loading, setLoading] = useState(!(cache && user && cache.userId === user.id));

  useEffect(() => {
    if (!user) return;
    const sync = () => { if (cache?.userId === user.id) setUrl(cache.url); };
    window.addEventListener(EVENT, sync);
    if (cache?.userId !== user.id) {
      supabase.from("profiles").select("booking_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        cache = { userId: user.id, url: data?.booking_url || null };
        setUrl(cache.url);
        setLoading(false);
      });
    }
    return () => window.removeEventListener(EVENT, sync);
  }, [user]);

  return { url, loading };
}

export function isValidBookingUrl(v: string) {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
