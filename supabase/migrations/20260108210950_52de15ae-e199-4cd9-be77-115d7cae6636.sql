-- Add admin UPDATE/DELETE policies for chat message moderation
-- (RLS already enabled on public.chat_messages)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Admins can update chat messages'
  ) THEN
    CREATE POLICY "Admins can update chat messages"
    ON public.chat_messages
    FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'Admins can delete chat messages'
  ) THEN
    CREATE POLICY "Admins can delete chat messages"
    ON public.chat_messages
    FOR DELETE
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;