CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.city_is_blocked(p_user_id uuid, p_location text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.city_exclusivities
    WHERE city_key = public.normalize_city_key(p_location)
      AND status IN ('active','past_due')
      AND user_id <> p_user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION private.city_is_blocked(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.city_is_blocked(uuid, text) TO authenticated, service_role;

DROP POLICY "Block saving results in exclusive cities" ON public.owner_search_results;
DROP POLICY "Block updating results in exclusive cities" ON public.owner_search_results;
DROP POLICY "Hide results in exclusive cities" ON public.owner_search_results;
CREATE POLICY "Block saving results in exclusive cities" ON public.owner_search_results
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT private.city_is_blocked(auth.uid(), search_location));
CREATE POLICY "Block updating results in exclusive cities" ON public.owner_search_results
  AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (NOT private.city_is_blocked(auth.uid(), search_location));
CREATE POLICY "Hide results in exclusive cities" ON public.owner_search_results
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT private.city_is_blocked(auth.uid(), search_location));

CREATE OR REPLACE FUNCTION public.check_city_access(p_location text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'blocked', private.city_is_blocked(auth.uid(), p_location),
    'mine', EXISTS (SELECT 1 FROM public.city_exclusivities WHERE user_id = auth.uid()
      AND city_key = public.normalize_city_key(p_location) AND status IN ('active','past_due'))
  )
$$;
DROP FUNCTION public.city_is_blocked(uuid, text);