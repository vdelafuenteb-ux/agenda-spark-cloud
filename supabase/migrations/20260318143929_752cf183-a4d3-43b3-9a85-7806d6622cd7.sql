ALTER TABLE public.notification_emails ADD COLUMN responded boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_emails ADD COLUMN responded_at timestamp with time zone;

CREATE POLICY "Users can update own notification emails"
ON public.notification_emails
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);