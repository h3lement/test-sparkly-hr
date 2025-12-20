-- Add quiz settings columns for question behavior
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_scoring boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS include_open_mindedness boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.quizzes.shuffle_questions IS 'Whether to randomize question order for each quiz session';
COMMENT ON COLUMN public.quizzes.enable_scoring IS 'Whether answers have point values that count toward results';
COMMENT ON COLUMN public.quizzes.include_open_mindedness IS 'Whether to include the optional open-mindedness assessment module';