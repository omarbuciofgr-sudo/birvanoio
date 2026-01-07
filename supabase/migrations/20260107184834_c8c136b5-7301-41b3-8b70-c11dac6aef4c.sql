-- Fix security_definer_functions: Add validation to handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_name_val TEXT;
  last_name_val TEXT;
BEGIN
  -- Validate and sanitize metadata - trim whitespace and handle nulls
  first_name_val := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), ''), NULL);
  last_name_val := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), ''), NULL);
  
  -- Limit length to prevent oversized data
  first_name_val := left(first_name_val, 100);
  last_name_val := left(last_name_val, 100);
  
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, first_name_val, last_name_val);
  
  -- Default new users to client role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Fix client_side_validation_only: Add database constraints for input validation

-- Add length constraints to profiles table
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_first_name_length CHECK (length(first_name) <= 100),
  ADD CONSTRAINT profiles_last_name_length CHECK (length(last_name) <= 100),
  ADD CONSTRAINT profiles_company_name_length CHECK (length(company_name) <= 200),
  ADD CONSTRAINT profiles_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add length constraints to leads table
ALTER TABLE public.leads
  ADD CONSTRAINT leads_business_name_length CHECK (length(business_name) <= 200),
  ADD CONSTRAINT leads_contact_name_length CHECK (length(contact_name) <= 100),
  ADD CONSTRAINT leads_notes_length CHECK (length(notes) <= 5000),
  ADD CONSTRAINT leads_email_length CHECK (length(email) <= 255),
  ADD CONSTRAINT leads_phone_length CHECK (length(phone) <= 50),
  ADD CONSTRAINT leads_city_length CHECK (length(city) <= 100),
  ADD CONSTRAINT leads_state_length CHECK (length(state) <= 100),
  ADD CONSTRAINT leads_industry_length CHECK (length(industry) <= 100),
  ADD CONSTRAINT leads_zip_code_length CHECK (length(zip_code) <= 20);