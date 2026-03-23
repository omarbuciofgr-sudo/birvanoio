-- Add INSERT policy for clients to create their own leads
CREATE POLICY "Clients can insert their own leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_id);