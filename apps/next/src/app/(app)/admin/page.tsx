import { loadRegistrations, loadRoster } from './actions';
import { AdminClient } from './AdminClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [{ rows, pending }, roster] = await Promise.all([loadRegistrations(), loadRoster()]);

  return (
    <div className={ui.pageWide}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Admin</p>
        <h1 className={ui.title}>Surface</h1>
        <p className={ui.sub}>Tiered control roster, moderation, and system settings.</p>
      </header>
      <AdminClient initialRegistrations={rows} initialPending={pending} initialRoster={roster} />
    </div>
  );
}
