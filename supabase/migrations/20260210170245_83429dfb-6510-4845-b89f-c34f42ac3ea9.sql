
DROP POLICY "Service can insert notifications" ON public.user_notifications;
CREATE POLICY "Users insert own notifications" ON public.user_notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
