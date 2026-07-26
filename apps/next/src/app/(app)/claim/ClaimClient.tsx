'use client';

import { useState } from 'react';
import { CC_BUNDLES, SHIPPING_FLAT, bundleByKey } from '@/lib/catalog';
import ui from '@/components/ui.module.css';
import styles from './claim.module.css';

export function ClaimClient({
  recommendedKey,
  email,
  code,
  discountPct,
}: {
  recommendedKey: string;
  email: string;
  code: string;
  discountPct: string;
}) {
  const [selectedKey, setSelectedKey] = useState(recommendedKey);
  const selected = bundleByKey(selectedKey);
  const recommended = bundleByKey(recommendedKey);
  const checkoutUrl = `${selected.url}${selected.url.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}`;
  const shortName = selected.name.replace(' + Hydration', '');

  return (
    <>
      <section className={ui.cardLime}>
        <p className={ui.kicker}>Matched to your assessment</p>
        <h2 className={styles.bundleName}>{recommended.name}</h2>
        <p className={ui.body}>{recommended.tagline}. {recommended.tag}.</p>
      </section>

      <section className={ui.card}>
        <p className={ui.kicker}>Choose your routine</p>
        <div className={styles.bundles}>
          {CC_BUNDLES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setSelectedKey(b.key)}
              className={`${styles.bundle} ${b.key === selectedKey ? styles.bundleActive : ''}`}
              aria-pressed={b.key === selectedKey}
            >
              <span className={styles.bundleTitle}>{b.name}</span>
              <span className={ui.sub}>{b.tag}</span>
              <span className={styles.bundlePrice}>
                ${b.member.toFixed(2)}/mo
                <span className={styles.bundleRetail}>${b.retail.toFixed(2)}</span>
              </span>
              {b.key === recommendedKey ? (
                <span className={ui.pillLime}>Your match</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className={ui.card}>
        <p className={ui.kicker}>What you&apos;re probably spending now</p>
        <div className={styles.valueRow}>
          <span>Daily coffee habit</span>
          <span>$120/mo</span>
        </div>
        <div className={styles.valueRow}>
          <span>Energy drinks</span>
          <span>$75/mo</span>
        </div>
        <div className={styles.valueRow}>
          <span>Supplements that ghost you</span>
          <span>$45/mo</span>
        </div>
        <div className={`${styles.valueRow} ${styles.valueTotal}`}>
          <span>Total broken pattern cost</span>
          <span>$240/mo</span>
        </div>
        <p className={ui.body}>
          Non-members pay ${selected.tryPrice.toFixed(2)}. You pay ${selected.member.toFixed(2)},
          that&apos;s ${(selected.retail - selected.member).toFixed(2)} under the $
          {selected.retail.toFixed(2)} retail value. Use code <strong>{code}</strong> at checkout.
        </p>
      </section>

      <section className={ui.cardLime}>
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={ui.primary}
        >
          Start my {shortName} routine
        </a>
        <p className={ui.sub}>
          ${selected.member.toFixed(2)}/mo · {discountPct} off the ${selected.tryPrice.toFixed(2)}{' '}
          try price · + ${SHIPPING_FLAT.toFixed(2)} shipping · use code {code} at checkout.
        </p>
        <div className={ui.row}>
          <span className={ui.pill}>Cancel anytime</span>
          <span className={ui.pill}>Feel it in 14 days</span>
          <span className={ui.pill}>{discountPct} member discount</span>
        </div>
      </section>
    </>
  );
}
