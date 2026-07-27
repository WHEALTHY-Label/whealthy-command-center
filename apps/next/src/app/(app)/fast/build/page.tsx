import { redirect } from 'next/navigation';
import { memberFn } from '@/lib/fn';
import { fetchLedger } from '@/lib/actions/prayers';
import {
  readinessRead,
  recommendAnchors,
  type FastHistoryRow,
  type RecordEntryLite,
} from '@/lib/fastbuild';
import { WizardClient } from './WizardClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

function obj(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * The most recent fast, read from index 0 because `governor-state` orders
 * `history` created_at DESC. The live app reads the last element, which is the
 * oldest row; that bug is not carried forward.
 */
function readLastFast(data: Record<string, unknown>): FastHistoryRow | null {
  if (!Array.isArray(data.history) || data.history.length === 0) return null;
  const h = obj(data.history[0]);
  if (Object.keys(h).length === 0) return null;
  return {
    model: str(h.model) || 'Fast',
    duration: typeof h.duration === 'number' ? h.duration : null,
    ended_day: typeof h.ended_day === 'number' ? h.ended_day : null,
    finished: h.finished === true,
    weak_rule: str(h.weak_rule) || null,
  };
}

function readEntries(data: Record<string, unknown>): RecordEntryLite[] {
  if (!Array.isArray(data.entries)) return [];
  return data.entries
    .map((e) => obj(e))
    .map((e) => ({
      text: str(e.text),
      tone: str(e.tone) || 'mixed',
      burned: e.burned === true,
    }));
}

export default async function FastBuildPage() {
  const [state, ledger] = await Promise.all([
    memberFn('governor-state', { action: 'load' }),
    fetchLedger(),
  ]);
  const data = state.ok ? state.data : {};

  // A fast already in flight owns the screen. Building a second one would
  // overwrite it silently, so the builder simply is not reachable.
  const existing = obj(data.fast);
  const status = str(existing.status);
  if (status === 'revealed' || status === 'active') redirect('/fast');

  const lastFast = readLastFast(data);
  const entries = readEntries(data);
  const productState = str(data.product_state) || 'unequipped';
  const equipped = productState === 'equipped';
  const historyCount = Array.isArray(data.history) ? data.history.length : 0;

  const opening = recommendAnchors(false, lastFast, equipped);

  const prayers = ledger.items
    .filter((p) => p.status !== 'answered' && p.body.trim().length > 0)
    .slice(0, 12)
    .map((p) => ({ id: p.id, body: p.body, category: p.category }));

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Build your fast</p>
        <h1 className={ui.title}>Scripture chooses the pattern</h1>
        <p className={ui.sub}>You bring the commitment.</p>
      </header>
      <WizardClient
        prayers={prayers}
        prayersError={ledger.error}
        lastFast={lastFast}
        historyCount={historyCount}
        equipped={equipped}
        openingAnchors={opening.anchors}
        openingReasons={opening.reasons}
        readiness={readinessRead(entries)}
        todayIso={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
