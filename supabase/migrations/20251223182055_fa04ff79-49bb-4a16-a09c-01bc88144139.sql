-- Drop the source_email_template_id column from cta_templates
ALTER TABLE public.cta_templates DROP COLUMN IF EXISTS source_email_template_id;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_cta_templates_source_email;