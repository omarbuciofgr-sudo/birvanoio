-- Add ElevenLabs Agent ID column to profiles table
ALTER TABLE public.profiles
ADD COLUMN elevenlabs_agent_id text;