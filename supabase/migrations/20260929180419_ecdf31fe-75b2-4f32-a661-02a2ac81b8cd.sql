ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS appointment_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS listing_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS list_price numeric,
  ADD COLUMN IF NOT EXISTS commission_rate numeric,
  ADD COLUMN IF NOT EXISTS estimated_commission numeric;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_commission_rate numeric NOT NULL DEFAULT 2.5;

CREATE OR REPLACE FUNCTION public.stamp_lead_stage_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM COALESCE(OLD.status, NULL) THEN
    IF NEW.status = 'appointment_set' AND NEW.appointment_set_at IS NULL THEN NEW.appointment_set_at := now(); END IF;
    IF NEW.status = 'listing_signed' AND NEW.listing_signed_at IS NULL THEN NEW.listing_signed_at := now(); END IF;
    IF NEW.status IN ('appointment_set','listing_signed') AND NEW.contacted_at IS NULL THEN NEW.contacted_at := now(); END IF;
  END IF;
  IF NEW.list_price IS NOT NULL AND NEW.commission_rate IS NOT NULL THEN
    IF NEW.list_price < 0 OR NEW.commission_rate < 0 OR NEW.commission_rate > 100 THEN
      RAISE EXCEPTION 'Invalid list price or commission rate';
    END IF;
    NEW.estimated_commission := round(NEW.list_price * NEW.commission_rate / 100, 2);
  ELSE
    NEW.estimated_commission := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stamp_lead_stage_dates ON public.leads;
CREATE TRIGGER stamp_lead_stage_dates BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.stamp_lead_stage_dates();