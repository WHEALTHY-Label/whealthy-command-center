-- Add said and will_do columns to bible_reflections
ALTER TABLE public.bible_reflections
  ADD COLUMN IF NOT EXISTS said text,
  ADD COLUMN IF NOT EXISTS will_do text;

-- Create book_intros table
CREATE TABLE IF NOT EXISTS public.book_intros (
  book text PRIMARY KEY,
  what_this_is text NOT NULL,
  who_its_for text NOT NULL,
  what_to_watch_for text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.book_intros ENABLE ROW LEVEL SECURITY;

-- Policy
DROP POLICY IF EXISTS "service_role_all" ON public.book_intros;
CREATE POLICY "service_role_all" ON public.book_intros
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed a handful of book intros
INSERT INTO public.book_intros (book, what_this_is, who_its_for, what_to_watch_for) VALUES
('Genesis', 
 'The book of origins and beginnings—narrating the creation of the universe, the fall of humanity, and the establishment of the covenant family through Abraham, Isaac, Jacob, and Joseph.',
 'Stewards seeking to understand the foundational identity of God as Creator and Promise-Keeper, and the origins of their spiritual heritage.',
 'The recurring pattern of God''s faithful promises in contrast to human failure, the key covenants, and the themes of election and providence.')
ON CONFLICT (book) DO UPDATE SET
  what_this_is = EXCLUDED.what_this_is,
  who_its_for = EXCLUDED.who_its_for,
  what_to_watch_for = EXCLUDED.what_to_watch_for,
  updated_at = now();

INSERT INTO public.book_intros (book, what_this_is, who_its_for, what_to_watch_for) VALUES
('Exodus',
 'The story of redemption, deliverance, and covenant—following the Israelites out of Egyptian bondage, their journey through the wilderness, the giving of the Law at Sinai, and the building of the Tabernacle.',
 'Stewards wanting to trace how God rescues a captive people, designs holy communities, and chooses to dwell among them.',
 'The character of Yahweh, the significance of the Passover, the Ten Commandments, and the detailed architecture of the Tabernacle as a dwelling place.')
ON CONFLICT (book) DO UPDATE SET
  what_this_is = EXCLUDED.what_this_is,
  who_its_for = EXCLUDED.who_its_for,
  what_to_watch_for = EXCLUDED.what_to_watch_for,
  updated_at = now();

INSERT INTO public.book_intros (book, what_this_is, who_its_for, what_to_watch_for) VALUES
('Leviticus',
 'A handbook for holiness, worship, and ritual purity—focusing on the sacrificial system, the priesthood, and the laws governing the daily life of a holy nation set apart for God.',
 'Stewards aiming to grasp the seriousness of sin, the necessity of atonement, and the practical demands of living a holy life in God''s presence.',
 'The Day of Atonement, the holiness code ("Be holy, for I am holy"), and the festivals/Jubilee laws that link justice and worship.')
ON CONFLICT (book) DO UPDATE SET
  what_this_is = EXCLUDED.what_this_is,
  who_its_for = EXCLUDED.who_its_for,
  what_to_watch_for = EXCLUDED.what_to_watch_for,
  updated_at = now();
