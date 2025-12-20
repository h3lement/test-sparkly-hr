-- Add primary_language column to quizzes table
-- Admins will edit content in this language, AI translates the rest
ALTER TABLE public.quizzes 
ADD COLUMN primary_language text NOT NULL DEFAULT 'en';

-- Add comment for documentation
COMMENT ON COLUMN public.quizzes.primary_language IS 'Language in which admin edits content (en or et). Other languages are AI-translated.';