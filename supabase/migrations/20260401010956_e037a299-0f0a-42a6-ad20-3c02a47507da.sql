
CREATE TABLE public.topic_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topic reminders"
  ON public.topic_reminders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own topic reminders"
  ON public.topic_reminders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topic reminders"
  ON public.topic_reminders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own topic reminders"
  ON public.topic_reminders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
