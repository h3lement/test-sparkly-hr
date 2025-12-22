-- Recreate policy with schema-qualified function (avoids search_path issues)
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;

CREATE POLICY "Admins can view email logs"
ON public.email_logs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));