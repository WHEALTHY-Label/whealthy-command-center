import { memberFn } from '@/lib/fn';
import { TRY_PRODUCTS } from '@/lib/catalog';
import { CodeBanner } from './CodeBanner';
import ui from '@/components/ui.module.css';
import styles from './tryall.module.css';

export const dynamic = 'force-dynamic';

export default async function TryAllPage() {
  const call = await memberFn('get-member-code', {});
  const verified = call.ok && call.data.verified === true;
  const code = verified && typeof call.data.code === 'string' ? call.data.code : null;
  const discount =
    verified && typeof call.data.discount === 'string' ? call.data.discount : '10%';

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Try All</p>
        <h1 className={ui.title}>Every routine in the house</h1>
        <p className={ui.sub}>
          Every routine in the house, open to try. When your season changes, this is where you
          re-match.
        </p>
      </header>

      <CodeBanner code={code} discount={discount} />

      {TRY_PRODUCTS.map((p) => (
        <section key={p.id} className={ui.card}>
          <div className={ui.row}>
            <h2 className={styles.productTitle}>{p.title}</h2>
            {p.tagline ? <span className={ui.pillLime}>{p.tagline}</span> : null}
          </div>
          <p className={ui.body}>{p.blurb}</p>
          <div className={ui.row}>
            <span className={styles.price}>${p.price}</span>
            <span className={styles.retail}>${p.retail}</span>
          </div>
          <p className={ui.sub}>
            Use your member code (in your discount card above) at checkout for {discount} off.
          </p>
          <div className={ui.row}>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className={ui.primary}>
              Add to routine
            </a>
            <a
              href="https://whealthylabel.com/steward-quiz"
              target="_blank"
              rel="noopener noreferrer"
              className={ui.quiet}
            >
              Or find your match
            </a>
          </div>
        </section>
      ))}
    </div>
  );
}
