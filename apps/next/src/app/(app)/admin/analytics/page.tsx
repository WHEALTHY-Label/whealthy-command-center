import Link from 'next/link';
import { adminFn } from '@/lib/fn';
import { parseAdminStats, parseRhythmStats } from '@/lib/adminview';
import ui from '@/components/ui.module.css';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

const RANGES = ['7d', '30d', '90d', 'all'] as const;
type Range = (typeof RANGES)[number];

function Bars({ pairs }: { pairs: [string, number][] }) {
  const max = Math.max(1, ...pairs.map(([, n]) => n));
  return (
    <div className={styles.chartList}>
      {pairs.map(([label, n]) => (
        <div key={label} className={styles.chartRow}>
          <span className={styles.chartLabel}>{label}</span>
          <span className={styles.chartTrack} aria-hidden="true">
            <span className={styles.chartFill} style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className={styles.chartValue}>{n}</span>
        </div>
      ))}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={ui.stat}>
      <span className={ui.statValue}>{value}</span>
      <span className={ui.statLabel}>{label}</span>
    </div>
  );
}

export default async function ControlPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range: Range = RANGES.includes(params.range as Range) ? (params.range as Range) : '30d';

  const [statsCall, rhythmCall] = await Promise.all([
    adminFn('admin-stats', { range }),
    adminFn('admin-rhythm-stats', {}),
  ]);
  const failed = !statsCall.ok;
  const s = parseAdminStats(statsCall.ok ? statsCall.data : null);
  const rhythm = parseRhythmStats(rhythmCall.ok ? rhythmCall.data : null);

  return (
    <div className={ui.pageWide}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Admin</p>
        <h1 className={ui.title}>Control Panel</h1>
        <p className={ui.sub}>
          Live analytics across members, disciplines, bundles, and the record.
        </p>
      </header>

      <div className={styles.rangeRow}>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/analytics?range=${r}`}
            className={r === range ? ui.chipActive : ui.chip}
          >
            {r === 'all' ? 'All time' : `${r.replace('d', '')} days`}
          </Link>
        ))}
      </div>

      {failed ? (
        <p className={ui.error}>
          {statsCall.status === 403 ? 'Admin access required.' : 'Analytics did not load. Try again.'}
        </p>
      ) : (
        <>
          <section className={ui.card}>
            <p className={ui.kicker}>Overview</p>
            <div className={ui.stats}>
              <Tile label="Free members" value={s.free} />
              <Tile label="Unverified" value={s.unverified} />
              <Tile label="Premium stewards" value={s.paid} />
              <Tile label="Purchasers" value={s.purchasers} />
              <Tile label="Free to premium" value={`${s.conv}%`} />
              <Tile label="MRR" value={`$${s.mrr}`} />
              <Tile label="Lapsed" value={s.churned} />
            </div>
          </section>

          <section className={ui.card}>
            <p className={ui.kicker}>App activity</p>
            <div className={ui.stats}>
              <Tile label="Active today" value={s.dau} />
              <Tile label="Active 7 days" value={s.wau} />
              <Tile label="Active 30 days" value={s.mau} />
              <Tile label="Opens this range" value={s.opens} />
              <Tile label="Tour completed" value={s.tourDone} />
            </div>
          </section>

          <section className={ui.card}>
            <p className={ui.kicker}>Disciplines</p>
            <div className={ui.stats}>
              <Tile label="Fasts started" value={s.fastsStarted} />
              <Tile label="Fasts active" value={s.fastsActive} />
              <Tile label="Fasts completed" value={s.fastsCompleted} />
              <Tile label="Prayers handed" value={s.prayerHanded} />
              <Tile label="Lifted to wall" value={s.prayerLifted} />
              <Tile label="Answered" value={s.prayerAnswered} />
              <Tile label="Testimonies" value={s.testimonies} />
              <Tile label="Open reports" value={s.reportsOpen} />
              <Tile label="Bible 365 readers" value={s.b365Users} />
              <Tile label="My Bible readers" value={s.myBibleReaders} />
              <Tile label="Words delivered" value={s.wordDeliveries} />
              <Tile label="Record entries" value={s.recordEntries} />
            </div>
          </section>

          <section className={ui.card}>
            <p className={ui.kicker}>Steward rhythms</p>
            <div className={ui.stats}>
              <Tile label="Active rhythms" value={rhythm.activePlans} />
              <Tile label="Draft rhythms" value={rhythm.draftPlans} />
              <Tile label="Members with plan" value={rhythm.membersWithPlan} />
              <Tile label="Assessments" value={rhythm.currentAssessments} />
              <Tile label="Avg 30d adherence" value={`${rhythm.avgAdherence30}%`} />
              <Tile label="Active anchors" value={rhythm.activeSlots} />
            </div>
            {rhythm.chronotypes.length > 0 ? (
              <>
                <p className={ui.sub}>Chronotypes</p>
                <Bars pairs={rhythm.chronotypes} />
              </>
            ) : null}
            {rhythm.byDomain.length > 0 ? (
              <>
                <p className={ui.sub}>Anchors by domain</p>
                <Bars pairs={rhythm.byDomain} />
              </>
            ) : null}
          </section>

          <section className={ui.card}>
            <p className={ui.kicker}>Community and groups</p>
            <div className={ui.stats}>
              <Tile label="Skool members" value={s.skoolMembers} />
              <Tile label="Skool posts" value={s.skoolPosts} />
              <Tile label="Circles" value={s.circles} />
              <Tile label="Cohorts" value={s.cohorts} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
