-- Add missing DELETE policy for voice_agent_calls
-- Table already has RLS enabled; we only add a scoped delete policy.

CREATE POLICY "Users can delete their own voice agent calls"
ON public.voice_agent_calls
FOR DELETE
USING (client_id = auth.uid());