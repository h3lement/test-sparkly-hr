-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "Allow quiz lead insertions" ON public.quiz_leads;

-- Create a more restrictive INSERT policy that validates quiz_id
CREATE POLICY "Allow quiz lead insertions for active quizzes"
ON public.quiz_leads
FOR INSERT
WITH CHECK (
  quiz_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.quizzes 
    WHERE id = quiz_id AND is_active = true
  )
);