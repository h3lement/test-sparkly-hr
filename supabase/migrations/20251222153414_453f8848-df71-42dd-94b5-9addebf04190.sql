-- Add body_content column to email_templates for storing per-language HTML content
ALTER TABLE public.email_templates 
ADD COLUMN IF NOT EXISTS body_content jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add a comment explaining the column
COMMENT ON COLUMN public.email_templates.body_content IS 'Per-language HTML body content. Keys are language codes (en, et, de, etc.), values are HTML strings with placeholders like {{score}}, {{maxScore}}, {{resultTitle}}, {{resultDescription}}, {{insights}}, {{opennessScore}}, etc.';