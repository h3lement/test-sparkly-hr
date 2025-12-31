-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Allow quiz lead insertions for active quizzes" ON public.quiz_leads;

-- Create as PERMISSIVE (default) policy
CREATE POLICY "Allow quiz lead insertions for active quizzes"
ON public.quiz_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  quiz_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM quizzes 
    WHERE quizzes.id = quiz_leads.quiz_id 
    AND quizzes.is_active = true
  )
);