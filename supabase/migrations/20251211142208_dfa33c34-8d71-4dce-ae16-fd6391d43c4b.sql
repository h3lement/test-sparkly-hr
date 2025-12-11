-- Allow users to delete their own profile (GDPR compliance)
CREATE POLICY "Users can delete own profile" 
ON public.profiles FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Allow admins to manage quiz leads (DELETE and UPDATE)
CREATE POLICY "Admins can update quiz leads" 
ON public.quiz_leads FOR UPDATE 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quiz leads" 
ON public.quiz_leads FOR DELETE 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role));