import { loadRegistrations, loadRoster } from './actions';
import { AdminClient } from './AdminClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [regs, roster] = await Promise.all([loadRegistrations(), loadRoster()]);
  // Either read can fail on its own. Show the first reason rather than an
  // empty panel that reads like a quiet system.
  const initialError = regs.error ?? roster.error;

  return (
    <div className={ui.pageWide}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Admin</p>
        <h1 className={ui.title}>Surface</h1>
        <p className={ui.sub}>Tiered control roster, moderation, and system settings.</p>
      </header>
      <AdminClient
        initialRegistrations={regs.rows}
        initialPending={regs.pending}
        initialRoster={roster.data}
        initialError={initialError}
      />
    </div>
  );
}
