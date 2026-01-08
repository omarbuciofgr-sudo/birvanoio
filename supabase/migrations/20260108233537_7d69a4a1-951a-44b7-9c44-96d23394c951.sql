-- Create message_templates table for SMS/Email templates library
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  subject TEXT, -- For emails only
  body TEXT NOT NULL,
  category TEXT, -- e.g., 'follow-up', 'introduction', 'closing'
  is_shared BOOLEAN NOT NULL DEFAULT false, -- Allow sharing with team
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scheduled_messages table for queued messages
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  subject TEXT, -- For emails
  body TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create webhook_integrations table for Zapier/webhooks
CREATE TABLE public.webhook_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('lead_created', 'lead_status_changed', 'lead_converted', 'call_completed', 'message_sent')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_assignments table for lead assignment
CREATE TABLE public.team_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL, -- user_id of team member
  assigned_by UUID NOT NULL, -- user_id of assigner
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Add unique constraint to prevent duplicate assignments
ALTER TABLE public.team_assignments 
ADD CONSTRAINT unique_lead_assignment UNIQUE (lead_id, assigned_to);

-- Enable RLS on all tables
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_templates
CREATE POLICY "Users can view their own templates or shared ones"
ON public.message_templates FOR SELECT
USING (client_id = auth.uid() OR is_shared = true);

CREATE POLICY "Users can create their own templates"
ON public.message_templates FOR INSERT
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update their own templates"
ON public.message_templates FOR UPDATE
USING (client_id = auth.uid());

CREATE POLICY "Users can delete their own templates"
ON public.message_templates FOR DELETE
USING (client_id = auth.uid());

-- RLS Policies for scheduled_messages
CREATE POLICY "Users can view their own scheduled messages"
ON public.scheduled_messages FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Users can create their own scheduled messages"
ON public.scheduled_messages FOR INSERT
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update their own scheduled messages"
ON public.scheduled_messages FOR UPDATE
USING (client_id = auth.uid());

CREATE POLICY "Users can delete their own scheduled messages"
ON public.scheduled_messages FOR DELETE
USING (client_id = auth.uid());

-- RLS Policies for webhook_integrations
CREATE POLICY "Users can view their own webhooks"
ON public.webhook_integrations FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Users can create their own webhooks"
ON public.webhook_integrations FOR INSERT
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update their own webhooks"
ON public.webhook_integrations FOR UPDATE
USING (client_id = auth.uid());

CREATE POLICY "Users can delete their own webhooks"
ON public.webhook_integrations FOR DELETE
USING (client_id = auth.uid());

-- RLS Policies for team_assignments (users can see assignments for their leads)
CREATE POLICY "Users can view assignments for their leads"
ON public.team_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = team_assignments.lead_id 
    AND leads.client_id = auth.uid()
  )
  OR assigned_to = auth.uid()
);

CREATE POLICY "Users can create assignments for their leads"
ON public.team_assignments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = team_assignments.lead_id 
    AND leads.client_id = auth.uid()
  )
);

CREATE POLICY "Users can update assignments for their leads"
ON public.team_assignments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = team_assignments.lead_id 
    AND leads.client_id = auth.uid()
  )
);

CREATE POLICY "Users can delete assignments for their leads"
ON public.team_assignments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = team_assignments.lead_id 
    AND leads.client_id = auth.uid()
  )
);

-- Add trigger for updated_at on message_templates
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add columns to leads table for enrichment data
ALTER TABLE public.leads
ADD COLUMN company_size TEXT,
ADD COLUMN estimated_revenue TEXT,
ADD COLUMN linkedin_url TEXT,
ADD COLUMN website TEXT,
ADD COLUMN social_profiles JSONB DEFAULT '{}'::jsonb;