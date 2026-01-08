-- Add lead_score column to leads table (0-100 score)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT NULL CHECK (lead_score >= 0 AND lead_score <= 100);

-- Add sentiment column to conversation_logs table
ALTER TABLE public.conversation_logs 
ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', NULL));

-- Add ai_qualified column to chat_messages for tracking AI qualification
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS ai_qualified BOOLEAN DEFAULT FALSE;

-- Add visitor_name and visitor_phone columns to chat_messages for lead capture
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS visitor_name TEXT DEFAULT NULL;

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS visitor_phone TEXT DEFAULT NULL;

-- Create index for faster lead score queries
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON public.leads(lead_score DESC NULLS LAST);

-- Create index for sentiment analysis queries
CREATE INDEX IF NOT EXISTS idx_conversation_logs_sentiment ON public.conversation_logs(sentiment);