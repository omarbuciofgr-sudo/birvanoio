-- Create email_campaigns table for drip campaigns
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_campaign_steps table for campaign sequences
CREATE TABLE public.email_campaign_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_campaign_enrollments for tracking which leads are in campaigns
CREATE TABLE public.lead_campaign_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'unsubscribed')),
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_step_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(lead_id, campaign_id)
);

-- Create voice_agent_calls table for AI voice agent tracking
CREATE TABLE public.voice_agent_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'no_answer')),
  script_template TEXT,
  ai_transcript TEXT,
  call_summary TEXT,
  call_outcome TEXT,
  duration_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_agent_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_campaigns
CREATE POLICY "Users can view their own campaigns" 
  ON public.email_campaigns FOR SELECT 
  USING (client_id = auth.uid());

CREATE POLICY "Users can create campaigns" 
  ON public.email_campaigns FOR INSERT 
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update their own campaigns" 
  ON public.email_campaigns FOR UPDATE 
  USING (client_id = auth.uid());

CREATE POLICY "Users can delete their own campaigns" 
  ON public.email_campaigns FOR DELETE 
  USING (client_id = auth.uid());

-- RLS policies for email_campaign_steps (via campaign ownership)
CREATE POLICY "Users can view steps of their campaigns" 
  ON public.email_campaign_steps FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.email_campaigns 
    WHERE id = campaign_id AND client_id = auth.uid()
  ));

CREATE POLICY "Users can create steps for their campaigns" 
  ON public.email_campaign_steps FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.email_campaigns 
    WHERE id = campaign_id AND client_id = auth.uid()
  ));

CREATE POLICY "Users can update steps of their campaigns" 
  ON public.email_campaign_steps FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.email_campaigns 
    WHERE id = campaign_id AND client_id = auth.uid()
  ));

CREATE POLICY "Users can delete steps of their campaigns" 
  ON public.email_campaign_steps FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.email_campaigns 
    WHERE id = campaign_id AND client_id = auth.uid()
  ));

-- RLS policies for lead_campaign_enrollments
CREATE POLICY "Users can view enrollments for their leads" 
  ON public.lead_campaign_enrollments FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.leads 
    WHERE id = lead_id AND client_id = auth.uid()
  ));

CREATE POLICY "Users can enroll their leads" 
  ON public.lead_campaign_enrollments FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads 
    WHERE id = lead_id AND client_id = auth.uid()
  ));

CREATE POLICY "Users can update enrollments for their leads" 
  ON public.lead_campaign_enrollments FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.leads 
    WHERE id = lead_id AND client_id = auth.uid()
  ));

CREATE POLICY "Users can delete enrollments for their leads" 
  ON public.lead_campaign_enrollments FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.leads 
    WHERE id = lead_id AND client_id = auth.uid()
  ));

-- RLS policies for voice_agent_calls
CREATE POLICY "Users can view their voice agent calls" 
  ON public.voice_agent_calls FOR SELECT 
  USING (client_id = auth.uid());

CREATE POLICY "Users can create voice agent calls" 
  ON public.voice_agent_calls FOR INSERT 
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Users can update their voice agent calls" 
  ON public.voice_agent_calls FOR UPDATE 
  USING (client_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_email_campaigns_client_id ON public.email_campaigns(client_id);
CREATE INDEX idx_campaign_steps_campaign_id ON public.email_campaign_steps(campaign_id);
CREATE INDEX idx_enrollments_lead_id ON public.lead_campaign_enrollments(lead_id);
CREATE INDEX idx_enrollments_next_send ON public.lead_campaign_enrollments(next_send_at) WHERE status = 'active';
CREATE INDEX idx_voice_calls_lead_id ON public.voice_agent_calls(lead_id);
CREATE INDEX idx_voice_calls_client_id ON public.voice_agent_calls(client_id);

-- Trigger for updated_at on email_campaigns
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();