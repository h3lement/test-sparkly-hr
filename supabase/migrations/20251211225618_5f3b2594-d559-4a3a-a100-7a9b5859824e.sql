-- Create email_logs table to track all Resend email sends
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL, -- 'test', 'quiz_result_user', 'quiz_result_admin'
  recipient_email TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  resend_id TEXT, -- ID returned by Resend API
  error_message TEXT,
  language TEXT,
  quiz_lead_id UUID REFERENCES public.quiz_leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "Admins can view email logs"
  ON public.email_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete email logs (for cleanup)
CREATE POLICY "Admins can delete email logs"
  ON public.email_logs
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_email_type ON public.email_logs(email_type);
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);