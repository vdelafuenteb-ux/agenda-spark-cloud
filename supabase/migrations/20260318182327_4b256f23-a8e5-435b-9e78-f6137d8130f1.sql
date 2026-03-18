-- Fix RLS policies: change from public to authenticated role

-- TOPICS
DROP POLICY IF EXISTS "Users can create own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can delete own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can update own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can view own topics" ON public.topics;

CREATE POLICY "Users can create own topics" ON public.topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own topics" ON public.topics FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own topics" ON public.topics FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own topics" ON public.topics FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- NOTES
DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;

CREATE POLICY "Users can create own notes" ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own notes" ON public.notes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- NOTEBOOKS
DROP POLICY IF EXISTS "Users can create own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can delete own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can update own notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Users can view own notebooks" ON public.notebooks;

CREATE POLICY "Users can create own notebooks" ON public.notebooks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notebooks" ON public.notebooks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notebooks" ON public.notebooks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own notebooks" ON public.notebooks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- TAGS
DROP POLICY IF EXISTS "Users can create own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;

CREATE POLICY "Users can create own tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- SUBTASKS
DROP POLICY IF EXISTS "Users can create own subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Users can delete own subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Users can update own subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Users can view own subtasks" ON public.subtasks;

CREATE POLICY "Users can create own subtasks" ON public.subtasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM topics WHERE topics.id = subtasks.topic_id AND topics.user_id = auth.uid()));
CREATE POLICY "Users can delete own subtasks" ON public.subtasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM topics WHERE topics.id = subtasks.topic_id AND topics.user_id = auth.uid()));
CREATE POLICY "Users can update own subtasks" ON public.subtasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM topics WHERE topics.id = subtasks.topic_id AND topics.user_id = auth.uid()));
CREATE POLICY "Users can view own subtasks" ON public.subtasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM topics WHERE topics.id = subtasks.topic_id AND topics.user_id = auth.uid()));

-- PROGRESS_ENTRIES
DROP POLICY IF EXISTS "Users can create own progress entries" ON public.progress_entries;
DROP POLICY IF EXISTS "Users can delete own progress entries" ON public.progress_entries;
DROP POLICY IF EXISTS "Users can update own progress entries" ON public.progress_entries;
DROP POLICY IF EXISTS "Users can view own progress entries" ON public.progress_entries;

CREATE POLICY "Users can create own progress entries" ON public.progress_entries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM topics WHERE topics.id = progress_entries.topic_id AND topics.user_id = auth.uid()));
CREATE POLICY "Users can delete own progress entries" ON public.progress_entries FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM topics WHERE topics.id = progress_entries.topic_id AND topics.user_id = auth.uid()));
CREATE POLICY "Users can update own progress entries" ON public.progress_entries FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM topics WHERE topics.id = progress_entries.topic_id AND topics.user_id = auth.uid()));
CREATE POLICY "Users can view own progress entries" ON public.progress_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM topics WHERE topics.id = progress_entries.topic_id AND topics.user_id = auth.uid()));

-- TOPIC_TAGS
DROP POLICY IF EXISTS "Users can create own topic_tags" ON public.topic_tags;
DROP POLICY IF EXISTS "Users can delete own topic_tags" ON public.topic_tags;
DROP POLICY IF EXISTS "Users can view own topic_tags" ON public.topic_tags;

CREATE POLICY "Users can create own topic_tags" ON public.topic_tags FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM topics WHERE topics.id = topic_tags.topic_id AND topics.user_id = auth.uid()));
CREATE POLICY "Users can delete own topic_tags" ON public.topic_tags FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM topics WHERE topics.id = topic_tags.topic_id AND topics.user_id = auth.uid()));
CREATE POLICY "Users can view own topic_tags" ON public.topic_tags FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM topics WHERE topics.id = topic_tags.topic_id AND topics.user_id = auth.uid()));

-- NOTE_TAGS
DROP POLICY IF EXISTS "Users can create own note_tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can delete own note_tags" ON public.note_tags;
DROP POLICY IF EXISTS "Users can view own note_tags" ON public.note_tags;

CREATE POLICY "Users can create own note_tags" ON public.note_tags FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()));
CREATE POLICY "Users can delete own note_tags" ON public.note_tags FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()));
CREATE POLICY "Users can view own note_tags" ON public.note_tags FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()));

-- REPORTS
DROP POLICY IF EXISTS "Users can create own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;

CREATE POLICY "Users can create own reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON public.reports FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = user_id);