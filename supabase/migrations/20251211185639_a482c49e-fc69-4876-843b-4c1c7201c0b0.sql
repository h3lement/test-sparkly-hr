-- Create pending admin emails table
CREATE TABLE public.pending_admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.pending_admin_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can manage pending admin emails
CREATE POLICY "Admins can view pending admin emails"
ON public.pending_admin_emails
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert pending admin emails"
ON public.pending_admin_emails
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pending admin emails"
ON public.pending_admin_emails
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update handle_new_user function to check pending admin emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pending_email_exists boolean;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  
  -- Check if this email was pre-approved as admin
  SELECT EXISTS (
    SELECT 1 FROM public.pending_admin_emails WHERE email = new.email
  ) INTO pending_email_exists;
  
  -- If pre-approved, grant admin role and remove from pending
  IF pending_email_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
    
    DELETE FROM public.pending_admin_emails WHERE email = new.email;
  END IF;
  
  RETURN new;
END;
$$;