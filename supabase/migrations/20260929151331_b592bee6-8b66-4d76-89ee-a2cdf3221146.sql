DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
CREATE POLICY "No client access" ON public.owner_alert_seen FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client access" ON public.city_search_cache FOR ALL TO authenticated USING (false) WITH CHECK (false);