-- Create email_queue table for queuing emails before sending
CREATE TABLE public.email_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processing_started_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  quiz_lead_id UUID,
  quiz_id UUID,
  language TEXT DEFAULT 'en',
  reply_to_email TEXT,
  CONSTRAINT email_queue_status_check CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'))
);

-- Create indexes for efficient queue processing
CREATE INDEX idx_email_queue_status_scheduled ON public.email_queue (status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_email_queue_created_at ON public.email_queue (created_at DESC);
CREATE INDEX idx_email_queue_quiz_lead_id ON public.email_queue (quiz_lead_id) WHERE quiz_lead_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies - admins can view and manage queue
CREATE POLICY "Admins can view email queue"
  ON public.email_queue
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email queue"
  ON public.email_queue
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email queue"
  ON public.email_queue
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add comment
COMMENT ON TABLE public.email_queue IS 'Queue for outgoing emails - processed by background job';