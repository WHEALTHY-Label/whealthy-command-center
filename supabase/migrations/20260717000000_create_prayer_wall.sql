-- WHEALTHY Prayer Wall Schema Migration
-- Create tables, views, indexes, RLS, and ranking functions

-- 1. Create helper view to securely map member profiles and avatars (service role access only)
create or replace view public.member_profile_display as
select 
  m.id as member_id,
  m.email,
  m.name,
  u.raw_user_meta_data->>'skool_avatar_url' as avatar_url
from public.approved_members m
left join auth.users u on u.email = m.email;

revoke select on public.member_profile_display from public, anon, authenticated;
grant select on public.member_profile_display to service_role;

-- 2. Create wall_posts table
create table if not exists public.wall_posts (
  id                      uuid primary key default gen_random_uuid(),
  member_id               bigint not null references public.approved_members(id) on delete cascade,
  source                  text not null check (source in ('bible365','wall')),
  body                    text not null check (char_length(trim(body)) between 1 and 1000),
  display_mode            text not null default 'anonymous' check (display_mode in ('signed','anonymous')),
  status                  text not null default 'live' check (status in ('live','archived','answered','held')),
  pray_count              integer not null default 0 check (pray_count >= 0),
  last_prayed_at          timestamptz,
  answered_at             timestamptz,
  answered_note           text check (answered_note is null or char_length(trim(answered_note)) between 1 and 1000),
  answered_note_locked_at timestamptz,
  amen_count              integer not null default 0 check (amen_count >= 0),
  created_at              timestamptz not null default now()
);

-- 3. Create wall_prays table
create table if not exists public.wall_prays (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.wall_posts(id) on delete cascade,
  member_id       bigint not null references public.approved_members(id) on delete cascade,
  created_at      timestamptz not null default now(),
  seen_answered_at timestamptz
);

-- 4. Create wall_amens table
create table if not exists public.wall_amens (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid not null references public.wall_posts(id) on delete cascade,
  member_id bigint not null references public.approved_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, member_id)
);

-- 5. Create wall_reports table
create table if not exists public.wall_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.wall_posts(id) on delete cascade,
  reporter_id bigint not null references public.approved_members(id) on delete cascade,
  reason      text check (reason is null or char_length(reason) <= 500),
  status      text not null default 'open' check (status in ('open','dismissed','upheld')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (post_id, reporter_id)
);

-- 6. Indexes
create index if not exists wall_prays_window_idx on public.wall_prays (post_id, member_id, created_at desc);
create index if not exists wall_prays_member_idx on public.wall_prays (member_id, created_at desc);

create index if not exists wall_posts_live_idx on public.wall_posts (status, last_prayed_at desc nulls last)
  where status = 'live';
create index if not exists wall_posts_needs_idx on public.wall_posts (status, pray_count, created_at desc)
  where status = 'live';
create index if not exists wall_posts_created_idx on public.wall_posts (status, created_at desc);
create index if not exists wall_posts_answered_idx on public.wall_posts (status, answered_at desc)
  where status = 'answered';
create index if not exists wall_posts_member_idx on public.wall_posts (member_id, created_at desc);

create index if not exists wall_amens_post_created_idx on public.wall_amens (post_id, created_at desc);
create index if not exists wall_reports_open_idx on public.wall_reports (status, created_at desc)
  where status = 'open';

-- 7. Enable RLS (with no permissive public policies, REST reads/writes blocked)
alter table public.wall_posts   enable row level security;
alter table public.wall_prays   enable row level security;
alter table public.wall_amens   enable row level security;
alter table public.wall_reports enable row level security;

-- 8. Ranking Functions
create or replace function public.wall_prayed_score(p_post_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(power(0.5, extract(epoch from (now() - created_at)) / 86400.0 / 10.0)), 0)
  from public.wall_prays
  where post_id = p_post_id;
$$;

create or replace function public.wall_top_testimonies(p_limit integer default 11)
returns setof public.wall_posts
language sql
stable
as $$
  select p.*
  from public.wall_posts p
  join public.wall_amens a on a.post_id = p.id
  where p.status = 'answered'
    and a.created_at > now() - interval '30 days'
  group by p.id
  order by count(a.id) desc, p.answered_at desc
  limit p_limit;
$$;
