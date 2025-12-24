-- Fix RLS policies on hypothesis_leads to ensure email addresses are protected
-- Drop existing policies and recreate as explicit PERMISSIVE policies

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can delete hypothesis leads" ON public.hypothesis_leads;
DROP POLICY IF EXISTS "Admins can update hypothesis leads" ON public.hypothesis_leads;
DROP POLICY IF EXISTS "Admins can view hypothesis leads" ON public.hypothesis_leads;
DROP POLICY IF EXISTS "Anyone can insert hypothesis leads" ON public.hypothesis_leads;

-- Recreate policies as PERMISSIVE (explicit)
CREATE POLICY "Admins can view hypothesis leads"
ON public.hypothesis_leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hypothesis leads"
ON public.hypothesis_leads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hypothesis leads"
ON public.hypothesis_leads
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert hypothesis leads"
ON public.hypothesis_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);