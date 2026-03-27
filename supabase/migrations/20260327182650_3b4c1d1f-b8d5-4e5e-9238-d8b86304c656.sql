
CREATE TABLE public.topic_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  previous_date date,
  new_date date,
  reason text NOT NULL DEFAULT '',
  is_external boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reschedules" ON public.topic_reschedules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reschedules" ON public.topic_reschedules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reschedules" ON public.topic_reschedules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_topic_reschedules_topic_id ON public.topic_reschedules(topic_id);
CREATE INDEX idx_topic_reschedules_user_id ON public.topic_reschedules(user_id);
