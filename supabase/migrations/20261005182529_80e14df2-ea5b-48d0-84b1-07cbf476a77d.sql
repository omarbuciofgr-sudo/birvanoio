CREATE TABLE public.city_exclusivities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_key text NOT NULL,
  city_label text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','canceled')),
  stripe_session_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.city_exclusivities TO authenticated;
GRANT ALL ON public.city_exclusivities TO service_role;
ALTER TABLE public.city_exclusivities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own city exclusivities" ON public.city_exclusivities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE UNIQUE INDEX city_exclusivities_one_holder ON public.city_exclusivities (city_key)
  WHERE status IN ('active','past_due');
CREATE TRIGGER update_city_exclusivities_updated_at BEFORE UPDATE ON public.city_exclusivities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.normalize_city_key(p_location text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(regexp_replace(lower(coalesce(p_location,'')), '[^a-z0-9]+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.city_is_blocked(p_user_id uuid, p_location text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.city_exclusivities
    WHERE city_key = public.normalize_city_key(p_location)
      AND status IN ('active','past_due')
      AND user_id <> p_user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.city_is_blocked(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.city_is_blocked(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_city_access(p_location text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'blocked', public.city_is_blocked(auth.uid(), p_location),
    'mine', EXISTS (SELECT 1 FROM public.city_exclusivities WHERE user_id = auth.uid()
      AND city_key = public.normalize_city_key(p_location) AND status IN ('active','past_due'))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.check_city_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_city_access(text) TO authenticated;

-- Server-side: nobody can save results for a city someone else holds exclusively.
CREATE POLICY "Block saving results in exclusive cities" ON public.owner_search_results
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.city_is_blocked(auth.uid(), search_location));
CREATE POLICY "Block updating results in exclusive cities" ON public.owner_search_results
  AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (NOT public.city_is_blocked(auth.uid(), search_location));
CREATE POLICY "Hide results in exclusive cities" ON public.owner_search_results
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.city_is_blocked(auth.uid(), search_location));