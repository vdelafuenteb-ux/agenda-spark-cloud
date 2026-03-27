ALTER TABLE public.update_tokens ADD COLUMN topic_id uuid DEFAULT NULL;
ALTER TABLE public.update_tokens ADD COLUMN used boolean NOT NULL DEFAULT false;