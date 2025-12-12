-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Allow anonymous page view inserts" ON public.page_views;

-- Create permissive INSERT policy for anonymous users
CREATE POLICY "Allow anonymous page view inserts" 
ON public.page_views 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);