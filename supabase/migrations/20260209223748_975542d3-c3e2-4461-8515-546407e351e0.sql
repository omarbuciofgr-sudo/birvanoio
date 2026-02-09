
-- Team activity log for tracking all actions (calls, emails, status changes, etc.)
CREATE TABLE public.team_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'call', 'email', 'sms', 'status_change', 'note', 'conversion', 'lead_created'
  description TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity" ON public.team_activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity" ON public.team_activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.team_activity_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_team_activity_user ON public.team_activity_log(user_id);
CREATE INDEX idx_team_activity_created ON public.team_activity_log(created_at DESC);
CREATE INDEX idx_team_activity_type ON public.team_activity_log(action_type);

-- Custom reports table for saved report configurations
CREATE TABLE public.custom_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL DEFAULT 'custom', -- 'conversion', 'outreach', 'revenue', 'response_time', 'custom'
  config JSONB NOT NULL DEFAULT '{}', -- stores metric selections, date ranges, filters
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reports" ON public.custom_reports
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared reports" ON public.custom_reports
  FOR SELECT USING (is_shared = true);

CREATE TRIGGER update_custom_reports_updated_at
  BEFORE UPDATE ON public.custom_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'alert'
  category TEXT DEFAULT 'system', -- 'system', 'lead', 'team', 'campaign', 'report'
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Allow system/admin to insert notifications for any user
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- Team performance snapshots (daily aggregated metrics per user)
CREATE TABLE public.team_performance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_made INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  sms_sent INTEGER NOT NULL DEFAULT 0,
  leads_contacted INTEGER NOT NULL DEFAULT 0,
  leads_converted INTEGER NOT NULL DEFAULT 0,
  leads_created INTEGER NOT NULL DEFAULT 0,
  revenue_generated NUMERIC(12,2) DEFAULT 0,
  avg_response_time_minutes INTEGER,
  pipeline_value NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE public.team_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own snapshots" ON public.team_performance_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all snapshots" ON public.team_performance_snapshots
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own snapshots" ON public.team_performance_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own snapshots" ON public.team_performance_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_performance_user_date ON public.team_performance_snapshots(user_id, snapshot_date DESC);
