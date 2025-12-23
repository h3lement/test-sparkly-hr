-- Add email content columns to quiz_leads
ALTER TABLE public.quiz_leads
ADD COLUMN email_html TEXT,
ADD COLUMN email_subject TEXT;

-- Add email content columns to hypothesis_leads
ALTER TABLE public.hypothesis_leads
ADD COLUMN email_html TEXT,
ADD COLUMN email_subject TEXT;

-- Add index for faster lookups when email content exists
CREATE INDEX idx_quiz_leads_email_html ON public.quiz_leads (id) WHERE email_html IS NOT NULL;
CREATE INDEX idx_hypothesis_leads_email_html ON public.hypothesis_leads (id) WHERE email_html IS NOT NULL;