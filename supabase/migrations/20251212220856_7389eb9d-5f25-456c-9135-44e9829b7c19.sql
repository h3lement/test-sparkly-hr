-- Create page_views table for tracking user journey through the quiz
CREATE TABLE public.page_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    page_slug text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_page_views_session_id ON public.page_views(session_id);
CREATE INDEX idx_page_views_page_slug ON public.page_views(page_slug);
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at);

-- Enable Row Level Security
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for tracking without auth)
CREATE POLICY "Allow anonymous page view inserts" 
ON public.page_views 
FOR INSERT 
WITH CHECK (true);

-- Only admins can view page views
CREATE POLICY "Admins can view page views" 
ON public.page_views 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete page views
CREATE POLICY "Admins can delete page views" 
ON public.page_views 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));