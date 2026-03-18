
CREATE TABLE public.reminder_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  completed_date date NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reminder_id, completed_date)
);

ALTER TABLE public.reminder_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminder completions"
  ON public.reminder_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reminder completions"
  ON public.reminder_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminder completions"
  ON public.reminder_completions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
