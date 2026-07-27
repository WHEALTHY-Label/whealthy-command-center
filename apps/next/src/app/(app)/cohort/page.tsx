import { memberFn } from '@/lib/fn';
import { loadGovernorState } from '@/lib/governorState';
import { deriveFastView } from '@/lib/fastview';
import { parseCohortBoard } from '@/lib/circles';
import { chicagoToday } from '@/lib/today';
import { CohortClient } from './CohortClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function CohortPage() {
  const state = await loadGovernorState();
  const fast = deriveFastView(state.ok ? state.data.fast : null, chicagoToday());

  let board = null;
  if (fast.cohortId) {
    const boardCall = await memberFn('cohort-board', { cohort_id: fast.cohortId });
    board = boardCall.ok ? parseCohortBoard(boardCall.data) : null;
  }

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Cohort Challenge</p>
        <h1 className={ui.title}>Fast together</h1>
        <p className={ui.sub}>Carry the weight beside your brothers.</p>
      </header>
      <CohortClient fast={fast} board={board} />
    </div>
  );
}
