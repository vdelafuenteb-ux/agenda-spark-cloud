ALTER TABLE public.topics ADD COLUMN closed_at timestamptz DEFAULT NULL;

-- Backfill existing completed topics
UPDATE public.topics SET closed_at = updated_at WHERE status = 'completado' AND closed_at IS NULL;