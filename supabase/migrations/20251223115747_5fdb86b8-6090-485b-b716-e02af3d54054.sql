-- Add delivery tracking columns to email_logs
ALTER TABLE public.email_logs
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS bounced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS complained_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS bounce_type text,
ADD COLUMN IF NOT EXISTS bounce_reason text,
ADD COLUMN IF NOT EXISTS complaint_type text,
ADD COLUMN IF NOT EXISTS provider_response jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS clicked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0;

-- Create index for webhook lookups by resend_id
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON public.email_logs(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_delivery_status ON public.email_logs(delivery_status);

-- Create a table to store all webhook events for audit trail
CREATE TABLE IF NOT EXISTS public.email_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resend_id text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook events
CREATE POLICY "Admins can view webhook events"
  ON public.email_webhook_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete webhook events"
  ON public.email_webhook_events
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert (for webhook function)
CREATE POLICY "Service role can insert webhook events"
  ON public.email_webhook_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update webhook events"
  ON public.email_webhook_events
  FOR UPDATE
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_webhook_events_resend_id ON public.email_webhook_events(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_webhook_events_event_type ON public.email_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_webhook_events_processed ON public.email_webhook_events(processed);