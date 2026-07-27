import Link from 'next/link';
import { dayName } from '@/lib/day';
import {
  DISCIPLINE_CARDS,
  MERCY_REF,
  chainChip,
  keptToday,
  keptTodayLine,
  quietState,
  type DotClass,
  type Ledger,
} from '@/lib/ledger';
import styles from './page.module.css';

/**
 * The Command Center's discipline ledger: the spelled-out count, the rhythm
 * chain chip, and the four discipline cards.
 *
 * This is the "Today's disciplines" card from index.html:15824, rebuilt from
 * the same `discipline-day` payload the live app read. All of the arithmetic
 * lives in `@/lib/ledger` where it is tested; everything here is markup.
 *
 * Server rendered on purpose. The chip is a picture of days that have already
 * happened, so there is nothing for the browser to do with it, and the mercy
 * verse arrives with the page instead of after a client fetch.
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

export function DisciplineLedger({
  ledger,
  today,
  fastRunning,
  mercyVerse,
}: {
  ledger: Ledger;
  today: string;
  fastRunning: boolean;
  mercyVerse: string | null;
}) {
  const chip = chainChip(ledger, 'rhythm', today);

  return (
    <>
      <p className={styles.keptLine}>{keptTodayLine(keptToday(ledger, today))}</p>

      {chip ? (
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
                      &ldquo;{mercyVerse}&rdquo;{' '}
                      <span className={styles.chainRef}>{MERCY_REF}</span>
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
      ) : null}

      {/* Four cards, not a fixed grid: the live app used
          `repeat(auto-fit, minmax(200px, 1fr))`, which lands as one column on a
          phone, two on a large phone or tablet, and four on a wide screen. */}
      <div className={styles.disciplineGrid}>
        {DISCIPLINE_CARDS.map((card) => {
          const quiet = quietState(card.key, ledger.lastActive[card.key], today, fastRunning);
          return (
            <Link
              key={card.key}
              href={card.href}
              className={styles.disciplineCard}
              style={{ opacity: quiet.opacity }}
            >
              <span className={styles.disciplineCardTitle}>{card.label}</span>
              <span className={styles.disciplineCardMeta}>{quiet.label}</span>
              {quiet.line ? <span className={styles.disciplineCardLine}>{quiet.line}</span> : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}
