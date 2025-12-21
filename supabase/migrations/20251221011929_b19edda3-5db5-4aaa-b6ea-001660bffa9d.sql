-- Add AI translation cost tracking fields to email_templates
ALTER TABLE public.email_templates
ADD COLUMN IF NOT EXISTS estimated_cost_eur numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS input_tokens integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_tokens integer DEFAULT 0;