-- Fix profiles table policies - drop RESTRICTIVE and create PERMISSIVE
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Fix quiz_leads table policies - drop RESTRICTIVE and create PERMISSIVE
DROP POLICY IF EXISTS "Admins can view all quiz leads" ON public.quiz_leads;
DROP POLICY IF EXISTS "Service role can insert quiz leads" ON public.quiz_leads;

CREATE POLICY "Admins can view all quiz leads" 
ON public.quiz_leads FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT policy for quiz submissions (edge function uses service role which bypasses RLS)
CREATE POLICY "Allow quiz lead insertions" 
ON public.quiz_leads FOR INSERT 
TO authenticated, anon
WITH CHECK (true);