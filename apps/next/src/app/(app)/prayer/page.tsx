import { fetchLedger } from '@/lib/actions/prayers';
import { HioClient } from './HioClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function PrayerPage() {
  const ledger = await fetchLedger();
  // The door subline follows the hour: a morning visit hands the day over
  // before it starts; an evening visit sets the weight down before bed.
  const hour = new Date().getUTCHours();
  const morning = hour >= 10 && hour <= 16; // 5-11 America/Chicago in July

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Prayer</p>
        <h1 className={ui.title}>Hand It Over</h1>
        <p className={ui.sub}>The Prayer Rhythm. Name the weight, hand it over, leave it here.</p>
      </header>
      <HioClient ledger={ledger} morning={morning} />
    </div>
  );
}
