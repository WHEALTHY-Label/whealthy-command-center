import { memberFn } from '@/lib/fn';
import { PersonalHeader } from '../PersonalHeader';
import { AffiliateClient } from './AffiliateClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function AffiliatePage() {
  // governor-state load carries the saved affiliate id and referral count.
  const call = await memberFn('governor-state', { action: 'load' });
  const refId =
    call.ok && typeof call.data.affiliate_ref_id === 'string' && call.data.affiliate_ref_id
      ? call.data.affiliate_ref_id
      : null;
  const referrals =
    call.ok && typeof call.data.referral_count === 'number' ? call.data.referral_count : 0;
  const progress = Math.min(100, Math.round((referrals / 3) * 100));

  return (
    <div className={ui.page}>
      <PersonalHeader view="affiliate" eyebrow="Affiliate Command" />

      <section className={ui.card}>
        <p className={ui.kicker}>Active referrals (unlock free month)</p>
        <div className={ui.row}>
          <span className={ui.statValue}>{referrals} / 3</span>
          <span className={ui.sub}>
            Refer three fellow stewards and your membership is covered.
          </span>
        </div>
        <div className={ui.meterTrack} aria-hidden="true">
          <div className={ui.meterFill} style={{ width: `${progress}%` }} />
        </div>
      </section>

      <AffiliateClient initialRefId={refId} />
    </div>
  );
}
