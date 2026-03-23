
CREATE TABLE public.subtask_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id uuid NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subtask_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subtask contacts"
ON public.subtask_contacts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM subtasks s JOIN topics t ON t.id = s.topic_id
  WHERE s.id = subtask_contacts.subtask_id AND t.user_id = auth.uid()
));

CREATE POLICY "Users can create own subtask contacts"
ON public.subtask_contacts FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM subtasks s JOIN topics t ON t.id = s.topic_id
  WHERE s.id = subtask_contacts.subtask_id AND t.user_id = auth.uid()
));

CREATE POLICY "Users can update own subtask contacts"
ON public.subtask_contacts FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM subtasks s JOIN topics t ON t.id = s.topic_id
  WHERE s.id = subtask_contacts.subtask_id AND t.user_id = auth.uid()
));

CREATE POLICY "Users can delete own subtask contacts"
ON public.subtask_contacts FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM subtasks s JOIN topics t ON t.id = s.topic_id
  WHERE s.id = subtask_contacts.subtask_id AND t.user_id = auth.uid()
));
