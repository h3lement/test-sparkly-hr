-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;

-- Create a permissive policy for admin SELECT
CREATE POLICY "Admins can view email logs" 
ON public.email_logs 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));