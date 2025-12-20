-- Add ICP and Buying Person columns to quizzes table for AI context
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS icp_description text DEFAULT '',
ADD COLUMN IF NOT EXISTS buying_persona text DEFAULT '';