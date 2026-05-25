
-- Fix team_activity SELECT: own user only
DROP POLICY IF EXISTS "Authenticated users can view activity" ON public.team_activity;
CREATE POLICY "Users can view own activity"
  ON public.team_activity FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix team_comments SELECT: own comments or comments on leads the user owns
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.team_comments;
CREATE POLICY "Users can view own or own-lead comments"
  ON public.team_comments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = team_comments.lead_id AND l.client_id = auth.uid()
    )
  );

-- Remove user-level INSERT/UPDATE on financial credit tables; only service role may write
DROP POLICY IF EXISTS "Users can insert own credit balance" ON public.credit_balances;
DROP POLICY IF EXISTS "Users can update own credit balance" ON public.credit_balances;

DROP POLICY IF EXISTS "Users can insert their own credit usage" ON public.enrichment_credit_usage;
DROP POLICY IF EXISTS "Users can update their own credit usage" ON public.enrichment_credit_usage;

DROP POLICY IF EXISTS "Users can insert their own credits" ON public.search_credits;
DROP POLICY IF EXISTS "Users can update their own credits" ON public.search_credits;

-- Remove contact_submissions from realtime publication to avoid PII broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.contact_submissions;
