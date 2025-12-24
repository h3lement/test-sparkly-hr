-- Add updated_at column to cta_templates
ALTER TABLE public.cta_templates 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_cta_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_cta_templates_updated_at ON public.cta_templates;
CREATE TRIGGER update_cta_templates_updated_at
BEFORE UPDATE ON public.cta_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_cta_templates_updated_at();