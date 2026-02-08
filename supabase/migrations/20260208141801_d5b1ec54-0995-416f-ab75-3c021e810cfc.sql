
-- 1. App settings table (key-value store for global config)
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert app settings" ON public.app_settings FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update app settings" ON public.app_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete app settings" ON public.app_settings FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Seed the default customization toggle
INSERT INTO public.app_settings (key, value) VALUES ('allow_user_metrics_customization', 'false');

-- 2. User metric settings table (per-user overrides)
CREATE TABLE public.user_metric_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_id text NOT NULL,
  weight integer NOT NULL DEFAULT 20,
  min_threshold numeric NOT NULL DEFAULT 0,
  ideal_threshold numeric NOT NULL DEFAULT 50,
  max_threshold numeric NOT NULL DEFAULT 100,
  method text,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric_id)
);

ALTER TABLE public.user_metric_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metric settings" ON public.user_metric_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own metric settings" ON public.user_metric_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own metric settings" ON public.user_metric_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own metric settings" ON public.user_metric_settings FOR DELETE USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_user_metric_settings_updated_at
  BEFORE UPDATE ON public.user_metric_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
