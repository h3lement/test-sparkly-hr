-- Add display_order column to quizzes table for drag-drop ordering
ALTER TABLE public.quizzes ADD COLUMN display_order integer DEFAULT 0;

-- Populate display_order based on created_at (newest first gets lower order number)
WITH ordered_quizzes AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
  FROM public.quizzes
)
UPDATE public.quizzes q
SET display_order = oq.rn
FROM ordered_quizzes oq
WHERE q.id = oq.id;

-- Create index for efficient ordering
CREATE INDEX idx_quizzes_display_order ON public.quizzes(display_order);