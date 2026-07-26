import { memberFn } from '@/lib/fn';
import { SKOOL_URL } from '@/lib/catalog';
import ui from '@/components/ui.module.css';
import styles from './community.module.css';

export const dynamic = 'force-dynamic';

interface FeedPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  authorName: string;
  likes: number;
  comments: number;
  postedAt: string | null;
}

function parseFeed(data: unknown): FeedPost[] {
  if (typeof data !== 'object' || data === null) return [];
  const feed = (data as Record<string, unknown>).feed;
  if (!Array.isArray(feed)) return [];
  return feed
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => ({
      id: String(p.id ?? p.slug ?? ''),
      slug: typeof p.slug === 'string' ? p.slug : '',
      title: typeof p.title === 'string' ? p.title : '',
      excerpt: typeof p.excerpt === 'string' ? p.excerpt : '',
      authorName: typeof p.author_name === 'string' ? p.author_name : 'A Steward',
      likes: typeof p.likes === 'number' ? p.likes : 0,
      comments: typeof p.comments === 'number' ? p.comments : 0,
      postedAt: typeof p.posted_at === 'string' ? p.posted_at : null,
    }));
}

function postDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default async function CommunityPage() {
  const call = await memberFn('skool-feed', {});
  const feed = call.ok ? parseFeed(call.data) : [];

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Community</p>
        <h1 className={ui.title}>Iron sharpens iron</h1>
        <p className={ui.sub}>
          Connect with fellow Stewards on Skool. Accountability partners, group challenges, and
          community support.
        </p>
      </header>

      <section className={ui.cardLime}>
        <p className={ui.kicker}>Stewards Community</p>
        <p className={ui.body}>
          The conversation lives on Skool. Step in, introduce yourself, and find your
          accountability partners.
        </p>
        <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer" className={ui.primary}>
          Open Skool community
        </a>
      </section>

      {feed.length > 0 ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Community feed</p>
          <ul className={styles.feed}>
            {feed.map((post) => (
              <li key={post.id}>
                <a
                  href={`${SKOOL_URL}/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.post}
                >
                  <div className={ui.row}>
                    <span className={styles.postTitle}>{post.title}</span>
                    <span className={ui.sub}>{postDate(post.postedAt)}</span>
                  </div>
                  {post.excerpt ? <p className={styles.excerpt}>{post.excerpt}</p> : null}
                  <p className={ui.sub}>
                    By {post.authorName} · 👍 {post.likes} · 💬 {post.comments}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
