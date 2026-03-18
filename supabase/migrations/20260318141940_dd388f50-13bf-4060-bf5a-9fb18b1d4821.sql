
-- Add email column to assignees
ALTER TABLE public.assignees ADD COLUMN email text DEFAULT NULL;

-- Create notification_emails log table
CREATE TABLE public.notification_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  assignee_name text NOT NULL,
  assignee_email text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification emails"
  ON public.notification_emails FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notification emails"
  ON public.notification_emails FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
