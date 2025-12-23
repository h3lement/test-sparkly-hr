-- Drop the previous triggers as they won't work with current edge function signatures
DROP TRIGGER IF EXISTS trigger_quiz_lead_email ON public.quiz_leads;
DROP TRIGGER IF EXISTS trigger_hypothesis_lead_email ON public.hypothesis_leads;
DROP FUNCTION IF EXISTS public.notify_quiz_lead_created();
DROP FUNCTION IF EXISTS public.notify_hypothesis_lead_created();

-- Create a simpler notification queue table for failed/missed emails
CREATE TABLE IF NOT EXISTS public.pending_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_type text NOT NULL CHECK (lead_type IN ('quiz', 'hypothesis')),
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(lead_type, lead_id)
);

-- Enable RLS
ALTER TABLE public.pending_email_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage
CREATE POLICY "Admins can manage pending notifications" ON public.pending_email_notifications
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert/update (for edge functions)
CREATE POLICY "Service can insert notifications" ON public.pending_email_notifications
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update notifications" ON public.pending_email_notifications
FOR UPDATE USING (true);

-- Create trigger function that queues leads for email processing
CREATE OR REPLACE FUNCTION public.queue_lead_for_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into pending notifications queue
  -- The frontend will try to send directly; this is a backup
  INSERT INTO public.pending_email_notifications (lead_type, lead_id)
  VALUES (
    CASE TG_TABLE_NAME 
      WHEN 'quiz_leads' THEN 'quiz'
      WHEN 'hypothesis_leads' THEN 'hypothesis'
    END,
    NEW.id
  )
  ON CONFLICT (lead_type, lead_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_queue_quiz_lead_email
  AFTER INSERT ON public.quiz_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_lead_for_email();

CREATE TRIGGER trigger_queue_hypothesis_lead_email
  AFTER INSERT ON public.hypothesis_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_lead_for_email();

-- Add index for efficient processing
CREATE INDEX IF NOT EXISTS idx_pending_notifications_status ON public.pending_email_notifications(status, created_at);