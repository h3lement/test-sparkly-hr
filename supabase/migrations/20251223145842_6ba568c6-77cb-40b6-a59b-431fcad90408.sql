-- Add hypothesis lead relation for hypothesis quizzes (e.g., /50plus)
ALTER TABLE public.email_logs
ADD COLUMN IF NOT EXISTS hypothesis_lead_id uuid;

ALTER TABLE public.email_logs
DROP CONSTRAINT IF EXISTS email_logs_hypothesis_lead_id_fkey;

ALTER TABLE public.email_logs
ADD CONSTRAINT email_logs_hypothesis_lead_id_fkey
FOREIGN KEY (hypothesis_lead_id)
REFERENCES public.hypothesis_leads(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_hypothesis_lead_id
ON public.email_logs(hypothesis_lead_id);

-- Keep queue items linked too (so sending + logging can preserve the link)
ALTER TABLE public.email_queue
ADD COLUMN IF NOT EXISTS hypothesis_lead_id uuid;

CREATE INDEX IF NOT EXISTS idx_email_queue_hypothesis_lead_id
ON public.email_queue(hypothesis_lead_id);
