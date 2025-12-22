-- Add name column to cta_templates for easier identification
ALTER TABLE public.cta_templates 
ADD COLUMN name text DEFAULT 'Untitled CTA';