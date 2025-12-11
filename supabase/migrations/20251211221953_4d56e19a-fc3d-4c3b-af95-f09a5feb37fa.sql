-- Create email_templates table for versioned email configuration
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_number integer NOT NULL DEFAULT 1,
  template_type text NOT NULL DEFAULT 'quiz_results',
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  subjects jsonb NOT NULL DEFAULT '{}',
  is_live boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_by_email text
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can view templates
CREATE POLICY "Admins can view email templates"
ON public.email_templates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert templates
CREATE POLICY "Admins can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update templates
CREATE POLICY "Admins can update email templates"
ON public.email_templates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete templates
CREATE POLICY "Admins can delete email templates"
ON public.email_templates
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_email_templates_live ON public.email_templates(template_type, is_live) WHERE is_live = true;

-- Insert default template with current configuration
INSERT INTO public.email_templates (
  sender_name,
  sender_email,
  subjects,
  is_live,
  created_by_email
) VALUES (
  'Sparkly.hr',
  'support@sparkly.hr',
  '{
    "en": "Your Team Performance Results",
    "et": "Sinu meeskonna tulemuslikkuse tulemused",
    "de": "Ihre Team-Leistungsergebnisse",
    "fr": "Vos résultats de performance d''équipe",
    "es": "Tus resultados de rendimiento del equipo",
    "it": "I tuoi risultati di performance del team",
    "pt": "Os seus resultados de desempenho da equipa",
    "nl": "Uw teamprestatie resultaten",
    "pl": "Twoje wyniki wydajności zespołu",
    "ru": "Результаты производительности вашей команды",
    "sv": "Dina teamprestationsresultat",
    "no": "Dine teamytelsesresultater",
    "da": "Dine teampræstationsresultater",
    "fi": "Tiimisuorituksesi tulokset",
    "uk": "Результати продуктивності вашої команди"
  }',
  true,
  'system@sparkly.hr'
);