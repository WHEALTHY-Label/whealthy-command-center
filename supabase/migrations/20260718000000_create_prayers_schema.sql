-- WHEALTHY Prayer Pillar Migration (Page 1)
-- 0. Hotfix: Enable RLS on bible_reflections and create service_role policy
ALTER TABLE public.bible_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.bible_reflections;
CREATE POLICY "service_role_all" ON public.bible_reflections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 1. Create prayers table
CREATE TABLE IF NOT EXISTS public.prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id bigint NOT NULL REFERENCES public.approved_members(id) ON DELETE CASCADE,

  body text NOT NULL
    CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),

  category text NOT NULL
    CHECK (category IN ('household','soul','provision','brothers','unaware')),

  state text NOT NULL DEFAULT 'not_yet'
    CHECK (state IN ('not_yet','yes','no')),

  asked_on date NOT NULL DEFAULT CURRENT_DATE,
  closed_on date,

  outcome text
    CHECK (outcome IS NULL OR char_length(trim(outcome)) BETWEEN 1 AND 1000),

  pinned boolean NOT NULL DEFAULT false,

  last_surfaced_at timestamptz,
  last_milestone_asked integer NOT NULL DEFAULT 0,

  wall_post_id uuid REFERENCES public.wall_posts(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- The one man who does not know he is being prayed for can never be published.
  -- He never opted into this community.
  CONSTRAINT unaware_never_publishes
    CHECK (NOT (category = 'unaware' AND wall_post_id IS NOT NULL)),

  -- A closed entry has a date and a sentence. An open one has neither.
  CONSTRAINT close_is_complete
    CHECK (
      (state = 'not_yet' AND closed_on IS NULL AND outcome IS NULL)
      OR
      (state IN ('yes','no') AND closed_on IS NOT NULL AND outcome IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS prayers_member_state_idx ON public.prayers (member_id, state);
CREATE INDEX IF NOT EXISTS prayers_surface_idx ON public.prayers (member_id, state, pinned DESC, last_surfaced_at ASC NULLS FIRST);
CREATE INDEX IF NOT EXISTS prayers_milestone_idx ON public.prayers (member_id, state, asked_on);

ALTER TABLE public.prayers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.prayers;
CREATE POLICY "service_role_all" ON public.prayers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Create member_prayer_state table
CREATE TABLE IF NOT EXISTS public.member_prayer_state (
  member_id bigint PRIMARY KEY REFERENCES public.approved_members(id) ON DELETE CASCADE,
  midday_next_movement integer NOT NULL DEFAULT 1
    CHECK (midday_next_movement BETWEEN 1 AND 6),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_prayer_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.member_prayer_state;
CREATE POLICY "service_role_all" ON public.member_prayer_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Add column fasts.prayer_id
ALTER TABLE public.fasts
  ADD COLUMN IF NOT EXISTS prayer_id uuid REFERENCES public.prayers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fasts_prayer_idx ON public.fasts (prayer_id);
