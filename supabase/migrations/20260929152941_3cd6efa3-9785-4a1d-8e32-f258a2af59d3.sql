ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'appointment_set';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'listing_signed';

CREATE TABLE public.lead_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_follow_ups_user_due ON public.lead_follow_ups (user_id, due_date) WHERE done_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_follow_ups TO authenticated;
GRANT ALL ON public.lead_follow_ups TO service_role;
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follow-ups" ON public.lead_follow_ups FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.client_id = auth.uid()));
CREATE TRIGGER lead_follow_ups_updated BEFORE UPDATE ON public.lead_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contacting a lead through the app moves it from New to Contacted.
CREATE OR REPLACE FUNCTION public.mark_lead_contacted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND coalesce(NEW.direction, 'outbound') = 'outbound' THEN
    UPDATE public.leads SET status = 'contacted', updated_at = now()
    WHERE id = NEW.lead_id AND status = 'new';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_lead_contacted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER conversation_logs_mark_contacted AFTER INSERT ON public.conversation_logs
  FOR EACH ROW EXECUTE FUNCTION public.mark_lead_contacted();