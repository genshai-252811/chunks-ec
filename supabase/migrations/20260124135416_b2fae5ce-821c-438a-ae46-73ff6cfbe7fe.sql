-- Create table for practice sentences
CREATE TABLE public.sentences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vietnamese TEXT NOT NULL,
  english TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('greeting', 'daily', 'business', 'expression', 'question')),
  difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow public read access (sentences are public content)
ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sentences" 
  ON public.sentences 
  FOR SELECT 
  USING (true);

-- Create table for metric settings (public, no auth required for this demo)
CREATE TABLE public.metric_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_id TEXT NOT NULL UNIQUE,
  weight INTEGER NOT NULL DEFAULT 20 CHECK (weight >= 0 AND weight <= 100),
  min_threshold NUMERIC NOT NULL,
  ideal_threshold NUMERIC NOT NULL,
  max_threshold NUMERIC NOT NULL,
  method TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and allow public access for demo
ALTER TABLE public.metric_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" 
  ON public.metric_settings 
  FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can update settings" 
  ON public.metric_settings 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can insert settings" 
  ON public.metric_settings 
  FOR INSERT 
  WITH CHECK (true);

-- Insert default sentences
INSERT INTO public.sentences (vietnamese, english, category, difficulty) VALUES
  ('Tôi rất vui được gặp bạn', 'I am very happy to meet you', 'greeting', 1),
  ('Chào buổi sáng! Hôm nay bạn thế nào?', 'Good morning! How are you today?', 'greeting', 1),
  ('Cảm ơn bạn rất nhiều', 'Thank you very much', 'greeting', 1),
  ('Hôm nay là một ngày tuyệt vời', 'Today is a wonderful day', 'daily', 1),
  ('Tôi đang học tiếng Anh mỗi ngày', 'I am learning English every day', 'daily', 2),
  ('Thời tiết hôm nay rất đẹp', 'The weather is beautiful today', 'daily', 1),
  ('Tôi thích uống cà phê vào buổi sáng', 'I like drinking coffee in the morning', 'daily', 2),
  ('Tôi có thể giúp gì cho bạn?', 'How can I help you?', 'business', 2),
  ('Chúng tôi sẽ liên hệ lại với bạn sớm', 'We will contact you soon', 'business', 3),
  ('Xin lỗi, bạn có thể nhắc lại được không?', 'Sorry, could you repeat that please?', 'business', 2),
  ('Tôi hiểu ý bạn rồi', 'I understand what you mean', 'business', 2),
  ('Đừng lo lắng, mọi thứ sẽ ổn thôi', 'Don''t worry, everything will be fine', 'expression', 2),
  ('Tôi tin bạn có thể làm được', 'I believe you can do it', 'expression', 2),
  ('Chúng ta hãy bắt đầu ngay bây giờ', 'Let''s start right now', 'expression', 2),
  ('Đây là cơ hội tuyệt vời', 'This is a great opportunity', 'expression', 2),
  ('Bạn đến từ đâu?', 'Where are you from?', 'question', 1),
  ('Bạn làm nghề gì?', 'What do you do for a living?', 'question', 2),
  ('Bạn có thể giải thích thêm được không?', 'Could you explain more?', 'question', 2),
  ('Khi nào chúng ta gặp nhau?', 'When shall we meet?', 'question', 2),
  ('Bạn nghĩ sao về điều này?', 'What do you think about this?', 'question', 2),
  ('Tôi rất hào hứng về dự án này', 'I am very excited about this project', 'expression', 3),
  ('Hãy làm việc cùng nhau', 'Let''s work together', 'expression', 2),
  ('Tôi đồng ý với bạn hoàn toàn', 'I completely agree with you', 'expression', 2),
  ('Chúng ta có thể thảo luận về điều này', 'We can discuss this', 'business', 2),
  ('Cảm ơn vì đã lắng nghe', 'Thank you for listening', 'greeting', 1);

-- Insert default metric settings
INSERT INTO public.metric_settings (metric_id, weight, min_threshold, ideal_threshold, max_threshold, method) VALUES
  ('volume', 40, -35, -15, 0, NULL),
  ('speechRate', 40, 90, 150, 220, 'energy-peaks'),
  ('acceleration', 5, 0, 50, 100, NULL),
  ('responseTime', 5, 2000, 200, 0, NULL),
  ('pauseManagement', 10, 0, 0, 2.71, NULL);