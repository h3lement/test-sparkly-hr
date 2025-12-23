-- Enable realtime for email_queue and email_logs tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_logs;