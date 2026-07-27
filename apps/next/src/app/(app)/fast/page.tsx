import { loadGovernorState } from '@/lib/governorState';
import { deriveFastView } from '@/lib/fastview';
import { parseReveal } from '@/lib/fastreveal';
import { chicagoToday } from '@/lib/today';
import { PersonalHeader } from '../PersonalHeader';
import { SurfaceLedger } from '../SurfaceLedger';
import { FastClient } from './FastClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function FastPage() {
  const state = await loadGovernorState();
  const raw = state.ok ? state.data.fast : null;
  const fast = deriveFastView(raw, chicagoToday());
  // The full plan is only read for the pre-Day-1 reveal. Every other state
  // renders from the lighter view, so a malformed plan cannot break them.
  const reveal = fast.kind === 'revealed' ? parseReveal(raw) : null;

  return (
    <div className={ui.page}>
      <PersonalHeader view="fast" eyebrow="The Fast" />
      {/* The fast chain and the fast card, above `fastRoot` as at
          index.html:8653. `fastRunning` decides whether the resting card asks
          for tonight's report, which it should only do mid-fast. */}
      <SurfaceLedger discipline="fast" showChain fastRunning={fast.kind === 'active'} />
      <FastClient fast={fast} reveal={reveal} />
    </div>
  );
}
