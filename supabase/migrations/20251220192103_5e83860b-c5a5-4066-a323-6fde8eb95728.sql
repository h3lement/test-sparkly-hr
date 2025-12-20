-- Add UPDATE policy for activity_logs so admins can update entries
CREATE POLICY "Admins can update activity logs"
ON public.activity_logs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));