
CREATE TABLE public.assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignees" ON public.assignees
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own assignees" ON public.assignees
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assignees" ON public.assignees
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own assignees" ON public.assignees
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
