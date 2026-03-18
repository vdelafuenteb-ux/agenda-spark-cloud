CREATE POLICY "Users can delete own notification emails"
ON public.notification_emails
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);