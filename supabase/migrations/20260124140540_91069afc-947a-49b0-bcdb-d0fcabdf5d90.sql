-- Create display_settings table for real-time visual feedback thresholds
CREATE TABLE public.display_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  quiet_threshold NUMERIC NOT NULL DEFAULT 0.3,
  good_threshold NUMERIC NOT NULL DEFAULT 0.6,
  powerful_threshold NUMERIC NOT NULL DEFAULT 0.8,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.display_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (same as metric_settings)
CREATE POLICY "Anyone can read display settings" 
ON public.display_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert display settings" 
ON public.display_settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update display settings" 
ON public.display_settings 
FOR UPDATE 
USING (true);

-- Insert default settings for energy display
INSERT INTO public.display_settings (setting_key, quiet_threshold, good_threshold, powerful_threshold)
VALUES ('energy_display', 0.3, 0.6, 0.8);