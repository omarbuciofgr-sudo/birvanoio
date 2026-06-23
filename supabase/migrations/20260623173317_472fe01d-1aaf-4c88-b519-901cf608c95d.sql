
-- Fix credits_ledger insert policy that was hard-blocking even service_role via PostgREST
DROP POLICY IF EXISTS "Service role insert credits_ledger" ON public.credits_ledger;
CREATE POLICY "Service role insert credits_ledger"
  ON public.credits_ledger FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Harden lead_routing_rules with a RESTRICTIVE policy so any future non-admin write path
-- still cannot set an arbitrary webhook_url. Only admins (or service_role) may write.
DROP POLICY IF EXISTS "Restrict lead_routing_rules writes to admins" ON public.lead_routing_rules;
CREATE POLICY "Restrict lead_routing_rules writes to admins"
  ON public.lead_routing_rules
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
