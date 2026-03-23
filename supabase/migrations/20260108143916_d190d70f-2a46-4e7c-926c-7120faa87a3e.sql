-- Add client communication settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN twilio_phone_number text,
ADD COLUMN sender_email text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.twilio_phone_number IS 'Client Twilio phone number for outbound calls/SMS (E.164 format)';
COMMENT ON COLUMN public.profiles.sender_email IS 'Client verified sender email for outbound emails';