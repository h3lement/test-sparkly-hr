-- Drop the constraint (not the index) that prevents tracking multiple visits
ALTER TABLE public.page_views DROP CONSTRAINT IF EXISTS page_views_session_page_unique;