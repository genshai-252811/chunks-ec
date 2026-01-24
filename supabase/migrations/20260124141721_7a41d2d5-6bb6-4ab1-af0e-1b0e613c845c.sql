-- Add sensitivity column to display_settings table
ALTER TABLE public.display_settings 
ADD COLUMN sensitivity NUMERIC NOT NULL DEFAULT 2.5;

-- Update default entry with sensitivity value
UPDATE public.display_settings 
SET sensitivity = 2.5 
WHERE setting_key = 'energy_display';