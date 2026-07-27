import { memberFn } from '@/lib/fn';
import { deriveFastView } from '@/lib/fastview';
import { chicagoToday } from '@/lib/today';
import { SurfaceLedger } from '../SurfaceLedger';
import { RecordClient, type RecordEntry } from './RecordClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

function parseEntries(data: unknown): RecordEntry[] {
  if (typeof data !== 'object' || data === null) return [];
  const entries = (data as Record<string, unknown>).entries;
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .filter((e) => typeof e.entry_date === 'string')
    .map((e) => ({
      entryDate: e.entry_date as string,
      text: typeof e.text === 'string' ? e.text : '',
      tone: e.tone === 'heavy' || e.tone === 'win' ? e.tone : ('mixed' as const),
      scribeLine: typeof e.scribe_line === 'string' ? e.scribe_line : null,
      fastDay: typeof e.fast_day === 'number' ? e.fast_day : null,
      burned: e.burned === true,
    }));
}

export default async function RecordPage() {
  const state = await memberFn('governor-state', { action: 'load' });
  const entries = state.ok ? parseEntries(state.data) : [];
  const fast = deriveFastView(state.ok ? state.data.fast : null, chicagoToday());
  const inFast = fast.kind === 'active';

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Steward&apos;s Journal</p>
        <h1 className={ui.title}>Your words, kept</h1>
        <p className={ui.sub}>Tonight&apos;s entry, the threads, and the wall of stones.</p>
      </header>
      {/* The Journal card sits directly under the header, as at
          index.html:8590. The live app drew no chain chip on this surface. */}
      <SurfaceLedger discipline="record" showChain={false} />
      <RecordClient
        entries={entries}
        fastChip={
          inFast
            ? `Fast Mode · Day ${fast.day}${fast.duration ? ` of ${fast.duration}` : ''}`
            : null
        }
        fastId={inFast ? fast.fastId : null}
        fastDay={inFast ? fast.day : null}
      />
    </div>
  );
}
