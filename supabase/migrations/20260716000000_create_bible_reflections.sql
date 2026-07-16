-- Daily Bible Reflections Table
CREATE TABLE IF NOT EXISTS bible_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_email TEXT NOT NULL,
  day_number INT NOT NULL,
  scripture_ref TEXT NOT NULL,
  text TEXT NOT NULL,
  share_personalization BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_email, day_number)
);

CREATE INDEX IF NOT EXISTS idx_bible_reflections_email_day ON bible_reflections (member_email, day_number DESC);
