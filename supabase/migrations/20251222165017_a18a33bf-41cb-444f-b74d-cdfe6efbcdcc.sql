-- Add is_live column to quiz_result_versions table
ALTER TABLE public.quiz_result_versions 
ADD COLUMN is_live boolean NOT NULL DEFAULT false;

-- Create a function to ensure only one version is live per quiz
CREATE OR REPLACE FUNCTION public.ensure_single_live_web_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_live = true THEN
    UPDATE public.quiz_result_versions 
    SET is_live = false 
    WHERE quiz_id = NEW.quiz_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce single live version per quiz
CREATE TRIGGER ensure_single_live_web_version_trigger
BEFORE UPDATE OF is_live ON public.quiz_result_versions
FOR EACH ROW
WHEN (NEW.is_live = true)
EXECUTE FUNCTION public.ensure_single_live_web_version();