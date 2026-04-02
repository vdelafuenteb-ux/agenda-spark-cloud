
CREATE TABLE public.reminder_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  day_of_week INTEGER NOT NULL DEFAULT 4,
  send_hour INTEGER NOT NULL DEFAULT 9,
  message TEXT NOT NULL DEFAULT '',
  recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminder emails"
  ON public.reminder_emails FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reminder emails"
  ON public.reminder_emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminder emails"
  ON public.reminder_emails FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminder emails"
  ON public.reminder_emails FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_reminder_emails_updated_at
  BEFORE UPDATE ON public.reminder_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
