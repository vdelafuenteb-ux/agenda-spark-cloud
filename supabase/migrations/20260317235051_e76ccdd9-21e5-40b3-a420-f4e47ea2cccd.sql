
CREATE TABLE public.progress_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress entries"
ON public.progress_entries FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.topics
  WHERE topics.id = progress_entries.topic_id
  AND topics.user_id = auth.uid()
));

CREATE POLICY "Users can create own progress entries"
ON public.progress_entries FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.topics
  WHERE topics.id = progress_entries.topic_id
  AND topics.user_id = auth.uid()
));

CREATE POLICY "Users can delete own progress entries"
ON public.progress_entries FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.topics
  WHERE topics.id = progress_entries.topic_id
  AND topics.user_id = auth.uid()
));
