-- Delete duplicate records using ctid, keeping only the first occurrence per session/page
DELETE FROM public.page_views a
WHERE EXISTS (
  SELECT 1 FROM public.page_views b
  WHERE a.session_id = b.session_id 
    AND a.page_slug = b.page_slug
    AND a.created_at > b.created_at
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.page_views 
ADD CONSTRAINT page_views_session_page_unique UNIQUE (session_id, page_slug);