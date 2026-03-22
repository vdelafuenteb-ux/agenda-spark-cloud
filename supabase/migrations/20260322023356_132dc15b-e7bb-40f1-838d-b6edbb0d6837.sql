
-- Create note_sections table
CREATE TABLE public.note_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.note_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own note_sections" ON public.note_sections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own note_sections" ON public.note_sections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own note_sections" ON public.note_sections FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own note_sections" ON public.note_sections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add section_id to notes
ALTER TABLE public.notes ADD COLUMN section_id uuid REFERENCES public.note_sections(id) ON DELETE SET NULL;
