-- Create table to store domain reputation history
CREATE TABLE public.domain_reputation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  overall_status TEXT NOT NULL,
  dnsbl_listed_count INTEGER NOT NULL DEFAULT 0,
  dnsbl_checked_count INTEGER NOT NULL DEFAULT 0,
  vt_malicious INTEGER DEFAULT 0,
  vt_suspicious INTEGER DEFAULT 0,
  vt_harmless INTEGER DEFAULT 0,
  vt_reputation INTEGER DEFAULT 0,
  recommendations JSONB DEFAULT '[]'::jsonb,
  full_result JSONB DEFAULT '{}'::jsonb,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.domain_reputation_history ENABLE ROW LEVEL SECURITY;

-- Admins can view history
CREATE POLICY "Admins can view domain reputation history"
ON public.domain_reputation_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert history
CREATE POLICY "Admins can insert domain reputation history"
ON public.domain_reputation_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete history
CREATE POLICY "Admins can delete domain reputation history"
ON public.domain_reputation_history
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for efficient queries
CREATE INDEX idx_domain_reputation_history_domain ON public.domain_reputation_history(domain);
CREATE INDEX idx_domain_reputation_history_checked_at ON public.domain_reputation_history(checked_at DESC);