-- Create app_settings table for global configurations
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default setting for user metrics customization
INSERT INTO public.app_settings (key, value)
VALUES ('allow_user_metrics_customization', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read app_settings
CREATE POLICY "Allow public read access" ON public.app_settings
    FOR SELECT USING (true);

-- Allow only admins to update app_settings
CREATE POLICY "Allow admin update" ON public.app_settings
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM public.user_roles WHERE role = 'admin'
        )
    );

-- Create user_metric_settings table
CREATE TABLE IF NOT EXISTS public.user_metric_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    metric_id TEXT NOT NULL,
    weight INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    min_threshold NUMERIC,
    ideal_threshold NUMERIC,
    max_threshold NUMERIC,
    method TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, metric_id)
);

-- Enable RLS for user_metric_settings
ALTER TABLE public.user_metric_settings ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own settings
CREATE POLICY "Users can read own settings" ON public.user_metric_settings
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own settings
CREATE POLICY "Users can insert own settings" ON public.user_metric_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own settings
CREATE POLICY "Users can update own settings" ON public.user_metric_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own settings
CREATE POLICY "Users can delete own settings" ON public.user_metric_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at trigger for both tables (checking if extension exists first)
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

DROP TRIGGER IF EXISTS handle_updated_at_app_settings ON public.app_settings;
CREATE TRIGGER handle_updated_at_app_settings
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);

DROP TRIGGER IF EXISTS handle_updated_at_user_metric_settings ON public.user_metric_settings;
CREATE TRIGGER handle_updated_at_user_metric_settings
    BEFORE UPDATE ON public.user_metric_settings
    FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
