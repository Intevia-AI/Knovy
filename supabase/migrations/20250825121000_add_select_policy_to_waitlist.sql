CREATE POLICY "Allow public read access"
ON public.waitlist
FOR SELECT
USING (true);
