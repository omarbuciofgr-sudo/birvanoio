-- Add new profile fields for signup
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS role_title text,
  ADD COLUMN IF NOT EXISTS industry text;

-- Update the handle_new_user trigger to capture additional metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  first_name_val TEXT;
  last_name_val TEXT;
BEGIN
  first_name_val := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), ''), NULL);
  last_name_val := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), ''), NULL);
  
  first_name_val := left(first_name_val, 100);
  last_name_val := left(last_name_val, 100);
  
  INSERT INTO public.profiles (user_id, email, first_name, last_name, phone, company_name, role_title, industry)
  VALUES (
    NEW.id, 
    NEW.email, 
    first_name_val, 
    last_name_val,
    left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), ''), NULL), 20),
    left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'company_name'), ''), NULL), 200),
    left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'role_title'), ''), NULL), 100),
    left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'industry'), ''), NULL), 100)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;