-- Add tags array to scraped_leads table
ALTER TABLE public.scraped_leads 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for tag searches
CREATE INDEX IF NOT EXISTS idx_scraped_leads_tags ON public.scraped_leads USING GIN(tags);

-- Create saved_searches table for advanced filtering
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on saved_searches
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Users can manage their own saved searches
CREATE POLICY "Users can view their saved searches" 
ON public.saved_searches 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create saved searches" 
ON public.saved_searches 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved searches" 
ON public.saved_searches 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved searches" 
ON public.saved_searches 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_searches_updated_at
BEFORE UPDATE ON public.saved_searches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();