
-- Create severity enum
CREATE TYPE public.incident_category AS ENUM ('leve', 'moderada', 'grave');

-- Create worker_incidents table
CREATE TABLE public.worker_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assignee_name TEXT NOT NULL,
  assignee_email TEXT NOT NULL DEFAULT '',
  category incident_category NOT NULL DEFAULT 'leve',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_incidents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own incidents" ON public.worker_incidents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own incidents" ON public.worker_incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incidents" ON public.worker_incidents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own incidents" ON public.worker_incidents FOR DELETE TO authenticated USING (auth.uid() = user_id);
