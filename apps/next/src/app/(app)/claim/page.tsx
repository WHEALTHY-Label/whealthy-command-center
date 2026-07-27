import Link from 'next/link';
import { getAuthedEmail } from '@/lib/auth/session';
import { memberFn } from '@/lib/fn';
import { loadGovernorState } from '@/lib/governorState';
import { FALLBACK_CODE, bundleByKey } from '@/lib/catalog';
import { PersonalHeader } from '../PersonalHeader';
import { ClaimClient } from './ClaimClient';
import ui from '@/components/ui.module.css';
import styles from './claim.module.css';

export const dynamic = 'force-dynamic';

export default async function ClaimPage() {
  const email = await getAuthedEmail();
  if (!email) return null;

  const [state, codeCall] = await Promise.all([
    loadGovernorState(),
    memberFn('get-member-code', {}),
  ]);

  const productState =
    state.ok && typeof state.data.product_state === 'string'
      ? state.data.product_state
      : 'unequipped';
  const bundleName =
    state.ok && typeof state.data.bundle_name === 'string' ? state.data.bundle_name : null;
  const nextEligible =
    state.ok && typeof state.data.next_eligible_date === 'string'
      ? state.data.next_eligible_date
      : null;
  const rec =
    state.ok && typeof state.data.recommendation === 'object' && state.data.recommendation !== null
      ? (state.data.recommendation as Record<string, unknown>)
      : {};
  const recommendedKey = bundleByKey(
    typeof rec.bundle_key === 'string' ? rec.bundle_key : null,
  ).key;

  const code =
    codeCall.ok && codeCall.data.verified === true && typeof codeCall.data.code === 'string'
      ? codeCall.data.code
      : FALLBACK_CODE;
  const discountPct =
    codeCall.ok && typeof codeCall.data.discount === 'string' ? codeCall.data.discount : '10%';

  const claimed = productState === 'equipped';

  return (
    <div className={ui.page}>
      {/* The live app titled this room after the steward, not after the state
          of his order: `personalMap.claim` at index.html:18510 read
          "<Name>'s Governance Bundle" whether or not the bundle was claimed.
          The card below already says "Active", so the state is not lost. */}
      <PersonalHeader view="claim" eyebrow="Claim Bundle" />

      {claimed ? (
        <>
          <section className={ui.cardLime}>
            <p className={ui.kicker}>Active</p>
            <h2 className={styles.bundleName}>Your {bundleName ?? 'WHEALTHY'} routine is active</h2>
            <p className={ui.body}>
              Your routine is active. Manage your routine, shipping, and next order here.
            </p>
            <div className={ui.row}>
              <span className={ui.pillGreen}>Status: Active</span>
              <span className={ui.pill}>Next shipment: {nextEligible ?? 'Pending'}</span>
            </div>
            <div className={ui.row}>
              <Link href="/portal" className={ui.quiet}>
                See your orders
              </Link>
              <a
                href="https://whealthylabel.com/member"
                target="_blank"
                rel="noopener noreferrer"
                className={ui.quiet}
              >
                Manage billing
              </a>
            </div>
          </section>
        </>
      ) : (
        <ClaimClient
          recommendedKey={recommendedKey}
          email={email}
          code={code}
          discountPct={discountPct}
        />
      )}
    </div>
  );
}
