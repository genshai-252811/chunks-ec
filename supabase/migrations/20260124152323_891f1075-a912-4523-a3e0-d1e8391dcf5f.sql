-- Drop existing check constraint and add new one with vocab and slang categories
ALTER TABLE public.sentences DROP CONSTRAINT IF EXISTS sentences_category_check;

ALTER TABLE public.sentences ADD CONSTRAINT sentences_category_check 
CHECK (category IN ('greeting', 'daily', 'business', 'expression', 'question', 'vocab', 'slang'));