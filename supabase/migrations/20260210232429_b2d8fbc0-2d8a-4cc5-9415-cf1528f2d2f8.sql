
-- Fix: Drop the overly permissive anonymous read policy on chat_messages
-- Visitors use Realtime subscriptions, not direct RLS queries
DROP POLICY IF EXISTS "Visitors can read their own session messages" ON public.chat_messages;
