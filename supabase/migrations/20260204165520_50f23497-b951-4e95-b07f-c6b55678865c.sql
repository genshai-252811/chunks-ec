-- Add new video-based metrics for eye contact, head stillness, and blink rate
INSERT INTO public.metric_settings (metric_id, weight, min_threshold, ideal_threshold, max_threshold, method)
VALUES 
  ('eyeContact', 0, 0, 80, 100, 'percentage'),
  ('headStillness', 0, 0, 85, 100, 'percentage'),
  ('blinkRate', 0, 10, 15, 25, 'count_per_minute')
ON CONFLICT (metric_id) DO NOTHING;