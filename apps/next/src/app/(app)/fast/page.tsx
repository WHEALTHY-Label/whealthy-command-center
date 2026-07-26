import { memberFn } from '@/lib/fn';
import { deriveFastView } from '@/lib/fastview';
import { FastClient } from './FastClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function FastPage() {
  const state = await memberFn('governor-state', { action: 'load' });
  const fast = deriveFastView(
    state.ok ? state.data.fast : null,
    new Date().toISOString().slice(0, 10),
  );

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>The Fast</p>
        <h1 className={ui.title}>Scripture chooses the pattern</h1>
        <p className={ui.sub}>You carry it.</p>
      </header>
      <FastClient fast={fast} />
    </div>
  );
}
