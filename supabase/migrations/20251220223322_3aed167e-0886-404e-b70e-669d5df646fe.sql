-- Create table to store versions of AI-generated result levels
CREATE TABLE public.quiz_result_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  result_levels JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost_eur NUMERIC(10, 4) DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_by_email TEXT
);

-- Enable RLS
ALTER TABLE public.quiz_result_versions ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage quiz result versions" 
ON public.quiz_result_versions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_quiz_result_versions_quiz_id ON public.quiz_result_versions(quiz_id);
CREATE INDEX idx_quiz_result_versions_created_at ON public.quiz_result_versions(created_at DESC);