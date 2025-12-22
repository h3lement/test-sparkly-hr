-- Add cta_template_id column to email_templates table
-- This creates a 1-to-many relationship: 1 CTA template -> many email templates
ALTER TABLE public.email_templates
ADD COLUMN cta_template_id uuid REFERENCES public.cta_templates(id) ON DELETE SET NULL;

-- Create an index for better query performance
CREATE INDEX idx_email_templates_cta_template_id ON public.email_templates(cta_template_id);