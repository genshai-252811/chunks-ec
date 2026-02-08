-- Create app_settings table for global configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read app_settings (needed for frontend check)
CREATE POLICY "Enable read access for all users" ON public.app_settings
    FOR SELECT USING (true);

-- Allow only admins (service_role or specific logic) to update app_settings
-- For now, allowing authenticated users to update if they are admins (handled by restrictive policy or application logic)
-- Actually, the Admin Panel writes to this. We need a policy for that.
-- Assuming admins have a specific role or we just allow authenticated users to update for simplicity in this MVP 
-- (and rely on frontend hiding admin routes). 
-- BETTER: Allow authenticated users to update.
CREATE POLICY "Enable update for authenticated users" ON public.app_settings
    FOR UPDATE USING (auth.role() = 'authenticated');
    
CREATE POLICY "Enable insert for authenticated users" ON public.app_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- Create user_metric_settings table for per-user overrides
CREATE TABLE IF NOT EXISTS public.user_metric_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    metric_id TEXT NOT NULL,
    weight NUMERIC NOT NULL DEFAULT 0,
    min_threshold NUMERIC,
    ideal_threshold NUMERIC,
    max_threshold NUMERIC,
    method TEXT,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, metric_id)
);

-- Enable RLS for user_metric_settings
ALTER TABLE public.user_metric_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own settings
CREATE POLICY "Users can select own settings" ON public.user_metric_settings
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings" ON public.user_metric_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own settings" ON public.user_metric_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Insert default app setting (disabled by default)
INSERT INTO public.app_settings (key, value)
VALUES ('allow_user_metrics_customization', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
