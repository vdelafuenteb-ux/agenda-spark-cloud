
-- Notebooks table
CREATE TABLE public.notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notebooks" ON public.notebooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notebooks" ON public.notebooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notebooks" ON public.notebooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notebooks" ON public.notebooks FOR DELETE USING (auth.uid() = user_id);

-- Notes table
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notebook_id uuid REFERENCES public.notebooks(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at on notes
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Note tags junction table
CREATE TABLE public.note_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  UNIQUE(note_id, tag_id)
);

ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own note_tags" ON public.note_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()));
CREATE POLICY "Users can create own note_tags" ON public.note_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()));
CREATE POLICY "Users can delete own note_tags" ON public.note_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()));

-- Storage bucket for note images
INSERT INTO storage.buckets (id, name, public) VALUES ('note-images', 'note-images', true);

-- Storage policies
CREATE POLICY "Users can upload note images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'note-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view note images" ON storage.objects FOR SELECT
  USING (bucket_id = 'note-images');
CREATE POLICY "Users can delete own note images" ON storage.objects FOR DELETE
  USING (bucket_id = 'note-images' AND (storage.foldername(name))[1] = auth.uid()::text);
