CREATE TABLE public.score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assignee_name text NOT NULL,
  score integer NOT NULL,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, assignee_name, snapshot_date)
);

ALTER TABLE public.score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots"
  ON public.score_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON public.score_snapshots FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage snapshots"
  ON public.score_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);