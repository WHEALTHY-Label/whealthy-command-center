import {
  DISCIPLINE_CARDS,
  chainChip,
  keptToday,
  keptTodayLine,
  quietState,
  type Ledger,
} from '@/lib/ledger';
import { ChainChip, DisciplineStatusCard } from './ledgerParts';
import styles from './page.module.css';

/**
 * The Command Center's discipline ledger: the spelled-out count, the rhythm
 * chain chip, and the four discipline cards.
 *
 * This is the "Today's disciplines" card from index.html:15824, rebuilt from
 * the same `discipline-day` payload the live app read. All of the arithmetic
 * lives in `@/lib/ledger` where it is tested; the chip and the cards are shared
 * with the discipline surfaces through `./ledgerParts`.
 *
 * Server rendered on purpose. The chip is a picture of days that have already
 * happened, so there is nothing for the browser to do with it, and the mercy
 * verse arrives with the page instead of after a client fetch.
 */
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

      {chip ? <ChainChip chip={chip} mercyVerse={mercyVerse} /> : null}

      {/* Four cards, not a fixed grid: the live app used
          `repeat(auto-fit, minmax(200px, 1fr))`, which lands as one column on a
          phone, two on a large phone or tablet, and four on a wide screen. */}
      <div className={styles.disciplineGrid}>
        {DISCIPLINE_CARDS.map((card) => (
          <DisciplineStatusCard
            key={card.key}
            label={card.label}
            quiet={quietState(card.key, ledger.lastActive[card.key], today, fastRunning)}
            href={card.href}
          />
        ))}
      </div>
    </>
  );
}
