
-- Table for user SMTP email accounts
CREATE TABLE public.user_email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT 'Primary',
  email_address TEXT NOT NULL,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password_encrypted TEXT NOT NULL,
  use_tls BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email accounts"
  ON public.user_email_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own email accounts"
  ON public.user_email_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own email accounts"
  ON public.user_email_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own email accounts"
  ON public.user_email_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_email_accounts_updated_at
  BEFORE UPDATE ON public.user_email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for verified caller ID phone numbers
CREATE TABLE public.user_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Primary',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  twilio_validation_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own phone numbers"
  ON public.user_phone_numbers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own phone numbers"
  ON public.user_phone_numbers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own phone numbers"
  ON public.user_phone_numbers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own phone numbers"
  ON public.user_phone_numbers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_phone_numbers_updated_at
  BEFORE UPDATE ON public.user_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
