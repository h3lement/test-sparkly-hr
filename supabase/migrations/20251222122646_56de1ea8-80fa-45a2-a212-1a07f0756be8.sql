-- Add quiz_id column to email_logs for direct quiz association
ALTER TABLE public.email_logs 
ADD COLUMN quiz_id uuid REFERENCES public.quizzes(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_email_logs_quiz_id ON public.email_logs(quiz_id);