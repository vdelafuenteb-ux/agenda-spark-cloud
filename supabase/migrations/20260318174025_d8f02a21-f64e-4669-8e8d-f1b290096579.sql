CREATE POLICY "Users can update own progress entries"
ON public.progress_entries
FOR UPDATE
TO public
USING (EXISTS (
  SELECT 1 FROM topics
  WHERE topics.id = progress_entries.topic_id AND topics.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM topics
  WHERE topics.id = progress_entries.topic_id AND topics.user_id = auth.uid()
));