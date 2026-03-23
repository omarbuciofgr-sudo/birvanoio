-- Add columns for call recording and call SID tracking
ALTER TABLE public.conversation_logs 
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS call_sid TEXT;

-- Add index for faster lookup by call_sid
CREATE INDEX IF NOT EXISTS idx_conversation_logs_call_sid ON public.conversation_logs(call_sid) WHERE call_sid IS NOT NULL;