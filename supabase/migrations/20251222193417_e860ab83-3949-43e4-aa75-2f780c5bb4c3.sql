-- Enable RLS on profiles table (policies already exist)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on quiz_leads table (policies already exist)
ALTER TABLE public.quiz_leads ENABLE ROW LEVEL SECURITY;