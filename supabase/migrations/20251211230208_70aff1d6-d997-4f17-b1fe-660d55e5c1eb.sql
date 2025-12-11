-- Add resend_attempts column to track retry count
ALTER TABLE public.email_logs 
ADD COLUMN resend_attempts INTEGER NOT NULL DEFAULT 0;

-- Add last_attempt_at to track when last resend was attempted
ALTER TABLE public.email_logs 
ADD COLUMN last_attempt_at TIMESTAMP WITH TIME ZONE;

-- Add original_log_id to link resend attempts to original email
ALTER TABLE public.email_logs 
ADD COLUMN original_log_id UUID REFERENCES public.email_logs(id) ON DELETE SET NULL;