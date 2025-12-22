-- Add web_result_version_id column to email_templates
ALTER TABLE public.email_templates 
ADD COLUMN web_result_version_id uuid REFERENCES public.quiz_result_versions(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_email_templates_web_result_version_id ON public.email_templates(web_result_version_id);