-- Enable realtime payload completeness
ALTER TABLE public.quiz_leads REPLICA IDENTITY FULL;
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;

-- Enable realtime publication for Respondents + Activity dashboards
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;