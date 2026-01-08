-- Add recording_url column to voice_agent_calls table for storing call recordings
ALTER TABLE public.voice_agent_calls
ADD COLUMN recording_url text;