-- Drop the restrictive policy
DROP POLICY IF EXISTS "Admins can view page views" ON public.page_views;

-- Create a permissive policy instead
CREATE POLICY "Admins can view page views"
ON public.page_views
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));