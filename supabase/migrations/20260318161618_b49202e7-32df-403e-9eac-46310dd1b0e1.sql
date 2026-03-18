ALTER TABLE public.notification_emails 
ADD COLUMN confirmed boolean NOT NULL DEFAULT false,
ADD COLUMN confirmed_at timestamptz DEFAULT NULL;