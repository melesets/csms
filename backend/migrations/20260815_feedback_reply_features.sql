ALTER TABLE feedback_replies ADD COLUMN reply_to_id integer NOT NULL DEFAULT 0;
ALTER TABLE feedback_replies ADD COLUMN seen_at timestamptz;