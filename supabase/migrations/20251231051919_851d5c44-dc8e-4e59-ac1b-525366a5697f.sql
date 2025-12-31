-- Fix hypothesis_leads insert policy to be PERMISSIVE (currently RESTRICTIVE which requires at least one permissive policy)
DROP POLICY IF EXISTS "Anyone can insert hypothesis leads" ON public.hypothesis_leads;

CREATE POLICY "Anyone can insert hypothesis leads" 
ON public.hypothesis_leads 
FOR INSERT 
TO public
WITH CHECK (true);

-- Make sure quiz_leads insert policy is also permissive for active quizzes
DROP POLICY IF EXISTS "Allow quiz lead insertions for active quizzes" ON public.quiz_leads;

CREATE POLICY "Allow quiz lead insertions for active quizzes"
ON public.quiz_leads
FOR INSERT
TO public
WITH CHECK (
  (quiz_id IS NOT NULL) AND 
  (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_leads.quiz_id AND quizzes.is_active = true))
);