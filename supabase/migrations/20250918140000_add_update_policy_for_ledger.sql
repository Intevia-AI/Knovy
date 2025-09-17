-- Remove the old service_role only insert policy
DROP POLICY IF EXISTS "Allow service_role to insert transcription logs" ON public.transcription_ledger;

-- Allow users to insert their own transcription logs
CREATE POLICY "Users can insert their own transcription logs"
ON public.transcription_ledger
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own transcription logs
CREATE POLICY "Users can update their own transcription logs"
ON public.transcription_ledger
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);