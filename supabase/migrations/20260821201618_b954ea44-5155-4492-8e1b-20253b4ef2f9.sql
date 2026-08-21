REVOKE ALL ON FUNCTION public.get_persona_experiment_analytics() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_persona_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_persona_experiment_analytics() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_persona_analytics() TO authenticated, service_role;