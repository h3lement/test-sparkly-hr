-- Create activity_logs table to track all changes in the system
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action_type TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', etc.
  table_name TEXT NOT NULL, -- 'quizzes', 'quiz_leads', 'email_logs', etc.
  record_id UUID NOT NULL,
  field_name TEXT, -- specific field changed (optional)
  old_value TEXT, -- previous value (optional)
  new_value TEXT, -- new value (optional)
  description TEXT, -- human-readable description of the change
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_activity_logs_table_record ON public.activity_logs(table_name, record_id);
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view activity logs
CREATE POLICY "Admins can view activity logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert activity logs
CREATE POLICY "Admins can insert activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete activity logs
CREATE POLICY "Admins can delete activity logs"
ON public.activity_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));