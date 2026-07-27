import { SKOOL_URL } from '@/lib/catalog';
import ui from '@/components/ui.module.css';
import styles from './community.module.css';

/**
 * The Skool invitation card, shared by two rooms because the live app shipped
 * it twice: once inside `#communityPromoCard` (index.html:8459) and once as the
 * whole of `#enterCommunityView` (8475). Same copy, same screenshot, same
 * destination; only the button caption differed.
 */
export function CommunityPromo({ icon, cta }: { icon?: string; cta: string }) {
  return (
    <section className={`${ui.card} ${styles.promo}`}>
      {icon ? (
        <p className={styles.promoIcon} aria-hidden="true">
          {icon}
        </p>
      ) : null}
      <h2 className={styles.promoTitle}>Stewards Community</h2>
      <p className={styles.promoBody}>
        Connect with fellow Stewards on Skool. Accountability partners, group challenges, and
        community support.
      </p>
      <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer" className={styles.shot}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a remote
            marketing screenshot on a CDN with no loader configured. */}
        <img
          src="https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/Screenshot_2026-07-16_at_3.25.52PM-4233600.png?format=webp"
          alt="The WHEALTHY community on Skool"
          className={styles.shotImage}
        />
      </a>
      <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer" className={ui.primary}>
        {cta}
      </a>
    </section>
  );
}
