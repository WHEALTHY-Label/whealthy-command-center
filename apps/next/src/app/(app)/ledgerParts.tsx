import Link from 'next/link';
import { dayName } from '@/lib/day';
import { MERCY_REF, type ChipView, type DotClass, type QuietState } from '@/lib/ledger';
import styles from './page.module.css';

/**
 * The two pieces of the discipline ledger that the live app drew in more than
 * one place: the chain chip and a single discipline status card.
 *
 * `renderChainChip` (index.html:12735) was called for four containers, three of
 * which live outside the dashboard, and `drawDisciplineCard`
 * (index.html:13129) was called from both the dashboard grid and
 * `updateSurfaceQuietStates`. They are components here for the same reason they
 * were functions there: the markup has to be identical everywhere it appears,
 * or a steward reads two different accounts of the same week.
 *
 * All of the arithmetic lives in `@/lib/ledger`, where it is tested. Everything
 * in this file is markup.
 */

const DOT_CLASS: Record<DotClass, string | undefined> = {
  filled: styles.dotFilled,
  graced: styles.dotGraced,
  missed: styles.dotMissed,
  dim: styles.dotDim,
};

const DOT_TITLE: Record<DotClass, string> = {
  filled: 'kept',
  graced: 'covered by mercy',
  missed: 'missed',
  dim: 'nothing recorded',
};

export function ChainChip({ chip, mercyVerse }: { chip: ChipView; mercyVerse: string | null }) {
  return (
    <div className={styles.chainChip}>
      <div className={styles.chainHeader}>
        <span className={styles.chainCount} aria-label={`${chip.current} day chain`}>
          {chip.current}
        </span>
        <div className={styles.chainMeta}>
          <span className={styles.chainState}>{chip.state}</span>
          {chip.showVerse ? (
            <span className={styles.chainVerse}>
              {mercyVerse ? (
                <>
                  &ldquo;{mercyVerse}&rdquo; <span className={styles.chainRef}>{MERCY_REF}</span>
                </>
              ) : (
                MERCY_REF
              )}
            </span>
          ) : null}
        </div>
      </div>
      <ul className={styles.chainDots} aria-label="This week">
        {chip.dots.map((dot) => (
          <li
            key={dot.date}
            className={`${styles.chainDot} ${DOT_CLASS[dot.cls] ?? ''}`}
            title={`${dayName(dot.date)}: ${DOT_TITLE[dot.cls]}`}
          >
            <span aria-hidden="true">{dot.label}</span>
            <span className={styles.srOnly}>
              {dayName(dot.date)}: {DOT_TITLE[dot.cls]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One discipline status card.
 *
 * `href` is null when the card is already standing on the surface it would
 * point at. The live app passed a `go(viewId)` handler in every case, so the
 * card on the Word surface was a button that navigated to the Word surface; a
 * link to the page you are reading is a promise the app cannot keep, so here it
 * renders as plain text instead. The card still dims and still carries the
 * invitation, which is the whole of what it is for.
 */
export function DisciplineStatusCard({
  label,
  quiet,
  href,
}: {
  label: string;
  quiet: QuietState;
  href: string | null;
}) {
  const body = (
    <>
      <span className={styles.disciplineCardTitle}>{label}</span>
      <span className={styles.disciplineCardMeta}>{quiet.label}</span>
      {quiet.line ? <span className={styles.disciplineCardLine}>{quiet.line}</span> : null}
    </>
  );

  if (!href) {
    return (
      <div className={styles.disciplineCard} style={{ opacity: quiet.opacity }}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={styles.disciplineCard} style={{ opacity: quiet.opacity }}>
      {body}
    </Link>
  );
}
