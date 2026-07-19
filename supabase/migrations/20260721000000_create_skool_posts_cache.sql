CREATE TABLE skool_posts (
  id text primary key,          -- skool post id
  slug text not null,           -- permalink slug: skool.com/bakndcreator/{slug}
  title text not null,
  excerpt text,                 -- first ~200 characters of content
  author_name text,             -- display name as shown in Skool
  likes int default 0,
  comments int default 0,
  posted_at timestamptz,
  synced_at timestamptz not null default now()
);

ALTER TABLE skool_posts ENABLE ROW LEVEL SECURITY;
