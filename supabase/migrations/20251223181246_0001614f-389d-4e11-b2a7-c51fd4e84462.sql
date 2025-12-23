-- Add source tracking column to cta_templates
ALTER TABLE public.cta_templates 
ADD COLUMN source_email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_cta_templates_source_email ON public.cta_templates(source_email_template_id);

-- Add comment for documentation
COMMENT ON COLUMN public.cta_templates.source_email_template_id IS 'References the email template this CTA was extracted from, if any';