
CREATE TABLE public.subtask_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id uuid NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subtask_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subtask entries" ON public.subtask_entries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subtasks s
    JOIN public.topics t ON t.id = s.topic_id
    WHERE s.id = subtask_entries.subtask_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own subtask entries" ON public.subtask_entries
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.subtasks s
    JOIN public.topics t ON t.id = s.topic_id
    WHERE s.id = subtask_entries.subtask_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own subtask entries" ON public.subtask_entries
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subtasks s
    JOIN public.topics t ON t.id = s.topic_id
    WHERE s.id = subtask_entries.subtask_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own subtask entries" ON public.subtask_entries
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subtasks s
    JOIN public.topics t ON t.id = s.topic_id
    WHERE s.id = subtask_entries.subtask_id AND t.user_id = auth.uid()
  ));
