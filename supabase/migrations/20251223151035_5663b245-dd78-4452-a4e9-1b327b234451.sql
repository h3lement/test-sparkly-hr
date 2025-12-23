-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function to trigger email sending for quiz leads
CREATE OR REPLACE FUNCTION public.notify_quiz_lead_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_key text;
  request_id bigint;
BEGIN
  -- Get Supabase URL from environment (stored in vault or as a setting)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings aren't available, use the project URL directly
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://itcnukhlqkrsirrznuig.supabase.co';
  END IF;
  
  -- Queue the HTTP request to the edge function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-quiz-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('request.jwt.claim.sub', true))
    ),
    body := jsonb_build_object(
      'trigger_source', 'database',
      'lead_id', NEW.id,
      'email', NEW.email,
      'quiz_id', NEW.quiz_id,
      'score', NEW.score,
      'total_questions', NEW.total_questions,
      'result_category', NEW.result_category,
      'openness_score', NEW.openness_score,
      'language', COALESCE(NEW.language, 'en'),
      'answers', NEW.answers
    )
  ) INTO request_id;
  
  RAISE LOG 'Quiz lead email trigger fired for lead %, request_id: %', NEW.id, request_id;
  
  RETURN NEW;
END;
$$;

-- Create a function to trigger email sending for hypothesis leads
CREATE OR REPLACE FUNCTION public.notify_hypothesis_lead_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_key text;
  request_id_user bigint;
  request_id_admin bigint;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://itcnukhlqkrsirrznuig.supabase.co';
  END IF;
  
  -- Queue user email
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-hypothesis-user-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('request.jwt.claim.sub', true))
    ),
    body := jsonb_build_object(
      'trigger_source', 'database',
      'lead_id', NEW.id,
      'email', NEW.email,
      'quiz_id', NEW.quiz_id,
      'session_id', NEW.session_id,
      'score', NEW.score,
      'total_questions', NEW.total_questions,
      'language', COALESCE(NEW.language, 'en')
    )
  ) INTO request_id_user;
  
  -- Queue admin email
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-hypothesis-admin-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('request.jwt.claim.sub', true))
    ),
    body := jsonb_build_object(
      'trigger_source', 'database',
      'lead_id', NEW.id,
      'email', NEW.email,
      'quiz_id', NEW.quiz_id,
      'session_id', NEW.session_id,
      'score', NEW.score,
      'total_questions', NEW.total_questions,
      'language', COALESCE(NEW.language, 'en')
    )
  ) INTO request_id_admin;
  
  RAISE LOG 'Hypothesis lead email triggers fired for lead %, user_request: %, admin_request: %', NEW.id, request_id_user, request_id_admin;
  
  RETURN NEW;
END;
$$;

-- Create triggers on the lead tables
DROP TRIGGER IF EXISTS trigger_quiz_lead_email ON public.quiz_leads;
CREATE TRIGGER trigger_quiz_lead_email
  AFTER INSERT ON public.quiz_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_quiz_lead_created();

DROP TRIGGER IF EXISTS trigger_hypothesis_lead_email ON public.hypothesis_leads;
CREATE TRIGGER trigger_hypothesis_lead_email
  AFTER INSERT ON public.hypothesis_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_hypothesis_lead_created();