-- Add separate hypothesis text fields for women and men
ALTER TABLE public.hypothesis_questions
ADD COLUMN hypothesis_text_woman jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN hypothesis_text_man jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Migrate existing data: copy hypothesis_text to both new columns
UPDATE public.hypothesis_questions
SET 
  hypothesis_text_woman = hypothesis_text,
  hypothesis_text_man = hypothesis_text
WHERE hypothesis_text != '{}'::jsonb;