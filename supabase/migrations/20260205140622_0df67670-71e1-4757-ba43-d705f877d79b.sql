-- Add video metrics columns to practice_results
ALTER TABLE public.practice_results 
ADD COLUMN IF NOT EXISTS eye_contact_score numeric,
ADD COLUMN IF NOT EXISTS hand_movement_score numeric,
ADD COLUMN IF NOT EXISTS blink_rate numeric;