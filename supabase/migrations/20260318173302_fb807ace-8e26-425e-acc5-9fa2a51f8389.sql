CREATE TABLE public.email_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  day_of_week integer NOT NULL DEFAULT 1,
  send_hour integer NOT NULL DEFAULT 9,
  send_minute integer NOT NULL DEFAULT 0,
  send_to_all_assignees boolean NOT NULL DEFAULT true,
  selected_assignee_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  send_all_topics boolean NOT NULL DEFAULT true,
  selected_topic_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules" ON public.email_schedules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own schedules" ON public.email_schedules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedules" ON public.email_schedules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedules" ON public.email_schedules FOR DELETE TO authenticated USING (auth.uid() = user_id);