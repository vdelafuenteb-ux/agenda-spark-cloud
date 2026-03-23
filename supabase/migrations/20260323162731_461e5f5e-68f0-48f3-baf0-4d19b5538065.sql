
ALTER TABLE public.topics ADD COLUMN hh_type text NULL;
ALTER TABLE public.topics ADD COLUMN hh_value numeric NULL;
ALTER TABLE public.assignees ADD COLUMN weekly_capacity numeric NOT NULL DEFAULT 45;
