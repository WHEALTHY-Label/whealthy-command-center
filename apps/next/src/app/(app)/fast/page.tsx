import { memberFn } from '@/lib/fn';
import { deriveFastView } from '@/lib/fastview';
import { parseReveal } from '@/lib/fastreveal';
import { chicagoToday } from '@/lib/today';
import { FastClient } from './FastClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function FastPage() {
  const state = await memberFn('governor-state', { action: 'load' });
  const raw = state.ok ? state.data.fast : null;
  const fast = deriveFastView(raw, chicagoToday());
  // The full plan is only read for the pre-Day-1 reveal. Every other state
  // renders from the lighter view, so a malformed plan cannot break them.
  const reveal = fast.kind === 'revealed' ? parseReveal(raw) : null;

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>The Fast</p>
        <h1 className={ui.title}>Scripture chooses the pattern</h1>
        <p className={ui.sub}>You carry it.</p>
      </header>
      <FastClient fast={fast} reveal={reveal} />
    </div>
  );
}
