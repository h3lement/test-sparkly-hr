-- Explicitly block anonymous access to profiles by revoking anon permissions
REVOKE ALL ON public.profiles FROM anon;

-- For user_roles: prevent privilege escalation by blocking all modifications
-- Only admins should be able to manage roles
CREATE POLICY "Only admins can manage roles" 
ON public.user_roles FOR ALL
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Revoke all anon permissions on user_roles 
REVOKE ALL ON public.user_roles FROM anon;