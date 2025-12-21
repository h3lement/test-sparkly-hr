
-- Add quiz_type to quizzes table to distinguish between standard and hypothesis quizzes
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS quiz_type text NOT NULL DEFAULT 'standard';

-- Create hypothesis_pages table (6 pages per quiz)
CREATE TABLE public.hypothesis_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  title jsonb NOT NULL DEFAULT '{}',
  description jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, page_number)
);

-- Create hypothesis_questions table (50 questions across pages)
CREATE TABLE public.hypothesis_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.hypothesis_pages(id) ON DELETE CASCADE,
  question_order integer NOT NULL,
  hypothesis_text jsonb NOT NULL DEFAULT '{}',
  interview_question jsonb NOT NULL DEFAULT '{}',
  truth_explanation jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create hypothesis_responses table (tracks user answers)
CREATE TABLE public.hypothesis_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES public.hypothesis_questions(id) ON DELETE CASCADE,
  answer_woman boolean,
  answer_man boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(session_id, question_id)
);

-- Create hypothesis_leads table (stores completed quiz submissions)
CREATE TABLE public.hypothesis_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  email text NOT NULL,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  feedback_new_learnings text,
  feedback_action_plan text,
  language text DEFAULT 'en',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create scheduled_emails table for 3-month follow-ups
CREATE TABLE public.scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.hypothesis_leads(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.hypothesis_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hypothesis_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hypothesis_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hypothesis_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hypothesis_pages
CREATE POLICY "Admins can manage hypothesis pages" ON public.hypothesis_pages
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view hypothesis pages for active quizzes" ON public.hypothesis_pages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM quizzes WHERE quizzes.id = hypothesis_pages.quiz_id AND quizzes.is_active = true
  ));

-- RLS Policies for hypothesis_questions
CREATE POLICY "Admins can manage hypothesis questions" ON public.hypothesis_questions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view hypothesis questions for active quizzes" ON public.hypothesis_questions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM hypothesis_pages hp
    JOIN quizzes q ON q.id = hp.quiz_id
    WHERE hp.id = hypothesis_questions.page_id AND q.is_active = true
  ));

-- RLS Policies for hypothesis_responses
CREATE POLICY "Anyone can insert hypothesis responses" ON public.hypothesis_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view hypothesis responses" ON public.hypothesis_responses
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete hypothesis responses" ON public.hypothesis_responses
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for hypothesis_leads
CREATE POLICY "Anyone can insert hypothesis leads" ON public.hypothesis_leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view hypothesis leads" ON public.hypothesis_leads
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update hypothesis leads" ON public.hypothesis_leads
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete hypothesis leads" ON public.hypothesis_leads
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for scheduled_emails
CREATE POLICY "Admins can manage scheduled emails" ON public.scheduled_emails
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_hypothesis_pages_quiz ON public.hypothesis_pages(quiz_id);
CREATE INDEX idx_hypothesis_questions_page ON public.hypothesis_questions(page_id);
CREATE INDEX idx_hypothesis_responses_session ON public.hypothesis_responses(session_id);
CREATE INDEX idx_hypothesis_responses_question ON public.hypothesis_responses(question_id);
CREATE INDEX idx_hypothesis_leads_quiz ON public.hypothesis_leads(quiz_id);
CREATE INDEX idx_hypothesis_leads_email ON public.hypothesis_leads(email);
CREATE INDEX idx_scheduled_emails_status ON public.scheduled_emails(status, scheduled_for);
