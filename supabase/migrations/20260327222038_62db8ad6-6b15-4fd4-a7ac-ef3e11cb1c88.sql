ALTER TABLE notification_emails ADD COLUMN reviewed boolean NOT NULL DEFAULT false;
ALTER TABLE notification_emails ADD COLUMN reviewed_at timestamptz DEFAULT NULL;