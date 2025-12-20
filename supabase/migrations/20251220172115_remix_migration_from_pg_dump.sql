CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  pending_email_exists boolean;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  
  -- Check if this email was pre-approved as admin
  SELECT EXISTS (
    SELECT 1 FROM public.pending_admin_emails WHERE email = new.email
  ) INTO pending_email_exists;
  
  -- If pre-approved, grant admin role and remove from pending
  IF pending_email_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
    
    DELETE FROM public.pending_admin_emails WHERE email = new.email;
  END IF;
  
  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


SET default_table_access_method = heap;

--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_type text NOT NULL,
    recipient_email text NOT NULL,
    sender_email text NOT NULL,
    sender_name text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    resend_id text,
    error_message text,
    language text,
    quiz_lead_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resend_attempts integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp with time zone,
    original_log_id uuid,
    html_body text
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    template_type text DEFAULT 'quiz_results'::text NOT NULL,
    sender_name text NOT NULL,
    sender_email text NOT NULL,
    subjects jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_live boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_by_email text
);


--
-- Name: page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    page_slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pending_admin_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_admin_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quiz_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    score integer NOT NULL,
    total_questions integer NOT NULL,
    result_category text NOT NULL,
    answers jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    openness_score integer,
    language text DEFAULT 'en'::text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


--
-- Name: pending_admin_emails pending_admin_emails_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_admin_emails
    ADD CONSTRAINT pending_admin_emails_email_key UNIQUE (email);


--
-- Name: pending_admin_emails pending_admin_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_admin_emails
    ADD CONSTRAINT pending_admin_emails_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: quiz_leads quiz_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_leads
    ADD CONSTRAINT quiz_leads_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_email_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_created_at ON public.email_logs USING btree (created_at DESC);


--
-- Name: idx_email_logs_email_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_email_type ON public.email_logs USING btree (email_type);


--
-- Name: idx_email_logs_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_recipient ON public.email_logs USING btree (recipient_email);


--
-- Name: idx_email_templates_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_live ON public.email_templates USING btree (template_type, is_live) WHERE (is_live = true);


--
-- Name: idx_page_views_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_views_created_at ON public.page_views USING btree (created_at);


--
-- Name: idx_page_views_page_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_views_page_slug ON public.page_views USING btree (page_slug);


--
-- Name: idx_page_views_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_views_session_id ON public.page_views USING btree (session_id);


--
-- Name: email_logs email_logs_original_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_original_log_id_fkey FOREIGN KEY (original_log_id) REFERENCES public.email_logs(id) ON DELETE SET NULL;


--
-- Name: email_logs email_logs_quiz_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_quiz_lead_id_fkey FOREIGN KEY (quiz_lead_id) REFERENCES public.quiz_leads(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: pending_admin_emails pending_admin_emails_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_admin_emails
    ADD CONSTRAINT pending_admin_emails_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_logs Admins can delete email logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete email logs" ON public.email_logs FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_templates Admins can delete email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete email templates" ON public.email_templates FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: page_views Admins can delete page views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete page views" ON public.page_views FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pending_admin_emails Admins can delete pending admin emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete pending admin emails" ON public.pending_admin_emails FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: quiz_leads Admins can delete quiz leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete quiz leads" ON public.quiz_leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_templates Admins can insert email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert email templates" ON public.email_templates FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pending_admin_emails Admins can insert pending admin emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert pending admin emails" ON public.pending_admin_emails FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_templates Admins can update email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update email templates" ON public.email_templates FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: quiz_leads Admins can update quiz leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update quiz leads" ON public.quiz_leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: quiz_leads Admins can view all quiz leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all quiz leads" ON public.quiz_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_logs Admins can view email logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view email logs" ON public.email_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_templates Admins can view email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view email templates" ON public.email_templates FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: page_views Admins can view page views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view page views" ON public.page_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pending_admin_emails Admins can view pending admin emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view pending admin emails" ON public.pending_admin_emails FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: page_views Allow anonymous page view inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anonymous page view inserts" ON public.page_views FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: quiz_leads Allow quiz lead insertions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow quiz lead insertions" ON public.quiz_leads FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: user_roles Only admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Users can delete own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: page_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_admin_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pending_admin_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: quiz_leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quiz_leads ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;