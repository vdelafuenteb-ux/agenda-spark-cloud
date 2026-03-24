
-- Create the entry_attachments table
CREATE TABLE public.entry_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('progress', 'subtask')),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT '',
  file_size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.entry_attachments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check ownership via entry
CREATE OR REPLACE FUNCTION public.owns_entry_attachment(_entry_id uuid, _entry_type text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _entry_type = 'progress' THEN EXISTS (
      SELECT 1 FROM progress_entries pe
      JOIN topics t ON t.id = pe.topic_id
      WHERE pe.id = _entry_id AND t.user_id = _user_id
    )
    WHEN _entry_type = 'subtask' THEN EXISTS (
      SELECT 1 FROM subtask_entries se
      JOIN subtasks s ON s.id = se.subtask_id
      JOIN topics t ON t.id = s.topic_id
      WHERE se.id = _entry_id AND t.user_id = _user_id
    )
    ELSE false
  END;
$$;

-- RLS policies
CREATE POLICY "Users can view own entry attachments"
  ON public.entry_attachments FOR SELECT TO authenticated
  USING (public.owns_entry_attachment(entry_id, entry_type, auth.uid()));

CREATE POLICY "Users can create own entry attachments"
  ON public.entry_attachments FOR INSERT TO authenticated
  WITH CHECK (public.owns_entry_attachment(entry_id, entry_type, auth.uid()));

CREATE POLICY "Users can delete own entry attachments"
  ON public.entry_attachments FOR DELETE TO authenticated
  USING (public.owns_entry_attachment(entry_id, entry_type, auth.uid()));

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-attachments', 'progress-attachments', true);

-- Storage policies: anyone can read (public bucket), authenticated can upload/delete in their folder
CREATE POLICY "Anyone can view progress attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'progress-attachments');

CREATE POLICY "Authenticated users can upload progress attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can delete own progress attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'progress-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
