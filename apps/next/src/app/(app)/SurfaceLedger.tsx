import { DISCIPLINE_CARDS, chainChip, quietState, type DisciplineKey } from '@/lib/ledger';
import { fetchLedgerFor } from '@/lib/ledgerFetch';
import { ChainChip, DisciplineStatusCard } from './ledgerParts';
import styles from './page.module.css';

/**
 * The ledger strip a single discipline surface carries above its own content.
 *
 * The live app put this on three surfaces and the port had it on none of them.
 * `updateSurfaceQuietStates` (index.html:13143) filled `wordQuietStateContainer`
 * (index.html:3009), `recordQuietStateContainer` (8590) and
 * `fastQuietStateContainer` (8654) with that surface's own status card, and
 * `renderAllChainChips` (12817) filled `word-chain-container` (3008) and
 * `fast-chain-container` (8653) with that discipline's chain chip. So the Word
 * surface opened with the word chain and the word card, the Fast surface with
 * the fast chain and the fast card, and the Journal surface with its card alone.
 * A steward could see how long he had held a discipline while standing inside
 * it, not only from the dashboard.
 *
 * `updateSurfaceQuietStates` also had a fourth branch, for
 * `prayerQuietStateContainer`. No element by that id exists anywhere in
 * index.html, so the branch never drew anything and the Prayer surface has no
 * card here either. Reproducing dead code is not parity.
 *
 * Rendered as its own async server component rather than as props on each page
 * so the `discipline-day` call sits outside the page's own `Promise.all` and
 * cannot delay it. `fetchLedgerDays` is request-cached, so the dashboard and a
 * surface asking in the same request still cost one call.
 */
export async function SurfaceLedger({
  discipline,
  showChain,
  fastRunning = false,
}: {
  discipline: DisciplineKey;
  /** The live app drew a chain chip on the Word and Fast surfaces only. */
  showChain: boolean;
  /**
   * Whether a fast is running. `quietState` consults it for the fast card
   * alone, because inviting a steward to file a fast report when no fast is
   * running is inviting him to do nothing.
   */
  fastRunning?: boolean;
}) {
  const { ledger, today, mercyVerse } = await fetchLedgerFor(showChain ? discipline : null);
  const chip = showChain ? chainChip(ledger, discipline, today) : null;
  const card = DISCIPLINE_CARDS.find((c) => c.key === discipline);
  const quiet = quietState(discipline, ledger.lastActive[discipline], today, fastRunning);

  return (
    <div className={styles.surfaceLedger}>
      {chip ? <ChainChip chip={chip} mercyVerse={mercyVerse} /> : null}
      {/* href is null on purpose: this card is standing on the surface it names. */}
      <DisciplineStatusCard label={card?.label ?? ''} quiet={quiet} href={null} />
    </div>
  );
}
