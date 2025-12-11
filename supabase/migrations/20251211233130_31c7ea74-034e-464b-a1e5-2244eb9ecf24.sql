-- Add html_body column to store full email content
ALTER TABLE public.email_logs ADD COLUMN html_body text;