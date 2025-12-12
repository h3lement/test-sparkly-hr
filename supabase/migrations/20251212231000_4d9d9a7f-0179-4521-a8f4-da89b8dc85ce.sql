-- Fix the INSERT policy - it's currently restrictive which blocks inserts
DROP POLICY IF EXISTS "Allow anonymous page view inserts" ON public.page_views;

-- Create a permissive INSERT policy for anonymous users
CREATE POLICY "Allow anonymous page view inserts"
ON public.page_views
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also fix the DELETE policy to be permissive
DROP POLICY IF EXISTS "Admins can delete page views" ON public.page_views;

CREATE POLICY "Admins can delete page views"
ON public.page_views
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));