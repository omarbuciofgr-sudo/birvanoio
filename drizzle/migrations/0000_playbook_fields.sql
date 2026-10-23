ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS listing_type text;
ALTER TABLE public.leads ADD CONSTRAINT leads_listing_type_check CHECK (listing_type IS NULL OR listing_type IN ('fsbo','frbo'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prospecting_role text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_prospecting_role_check CHECK (prospecting_role IS NULL OR prospecting_role IN ('agent','investor','leasing_agent','property_manager'));
ALTER TABLE public.conversation_logs ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE public.conversation_logs ADD CONSTRAINT conversation_logs_outcome_check CHECK (outcome IS NULL OR outcome IN ('no_answer','voicemail','conversation','not_interested','appointment_set','do_not_call'));

CREATE OR REPLACE FUNCTION public.derive_lead_listing_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.listing_type IS NULL AND NEW.notes IS NOT NULL THEN
    IF NEW.notes ~* 'listing type:\s*rent' THEN NEW.listing_type := 'frbo';
    ELSIF NEW.notes ~* 'listing type:\s*sale' THEN NEW.listing_type := 'fsbo';
    ELSIF NEW.notes ~* '(frbo|for rent)' AND NEW.notes !~* 'fsbo' THEN NEW.listing_type := 'frbo';
    ELSIF NEW.notes ~* '(fsbo|for sale)' AND NEW.notes !~* 'frbo' THEN NEW.listing_type := 'fsbo';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS leads_derive_listing_type ON public.leads;
CREATE TRIGGER leads_derive_listing_type BEFORE INSERT OR UPDATE OF notes, listing_type ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.derive_lead_listing_type();

UPDATE public.leads SET listing_type = CASE
  WHEN notes ~* 'listing type:\s*rent' THEN 'frbo'
  WHEN notes ~* 'listing type:\s*sale' THEN 'fsbo'
  WHEN notes ~* '(frbo|for rent)' AND notes !~* 'fsbo' THEN 'frbo'
  WHEN notes ~* '(fsbo|for sale)' AND notes !~* 'frbo' THEN 'fsbo'
END
WHERE listing_type IS NULL AND notes IS NOT NULL;