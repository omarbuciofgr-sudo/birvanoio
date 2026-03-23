-- Create conversation_logs table for tracking all lead interactions
CREATE TABLE public.conversation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'sms', 'note')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  content TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversation_logs ENABLE ROW LEVEL SECURITY;

-- Clients can view their own conversation logs
CREATE POLICY "Clients can view their own conversation logs"
ON public.conversation_logs
FOR SELECT
USING (auth.uid() = client_id);

-- Clients can create their own conversation logs
CREATE POLICY "Clients can insert their own conversation logs"
ON public.conversation_logs
FOR INSERT
WITH CHECK (auth.uid() = client_id);

-- Clients can update their own conversation logs
CREATE POLICY "Clients can update their own conversation logs"
ON public.conversation_logs
FOR UPDATE
USING (auth.uid() = client_id);

-- Clients can delete their own conversation logs
CREATE POLICY "Clients can delete their own conversation logs"
ON public.conversation_logs
FOR DELETE
USING (auth.uid() = client_id);

-- Admins can manage all conversation logs
CREATE POLICY "Admins can manage all conversation logs"
ON public.conversation_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to conversation_logs"
ON public.conversation_logs
FOR ALL
USING (false);

-- Create index for faster lookups
CREATE INDEX idx_conversation_logs_lead_id ON public.conversation_logs(lead_id);
CREATE INDEX idx_conversation_logs_client_id ON public.conversation_logs(client_id);