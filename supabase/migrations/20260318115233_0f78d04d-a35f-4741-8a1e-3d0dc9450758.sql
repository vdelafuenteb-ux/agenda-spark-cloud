ALTER TYPE public.topic_status ADD VALUE 'seguimiento';
ALTER TABLE public.topics ADD COLUMN assignee text;