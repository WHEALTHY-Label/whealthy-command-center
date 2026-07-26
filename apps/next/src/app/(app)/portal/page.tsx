import { memberFnGet } from '@/lib/fn';
import { formatMoney, formatOrderDate, parseOrders } from '@/lib/orders';
import { BILLING_PORTAL_URL } from '@/lib/catalog';
import Link from 'next/link';
import ui from '@/components/ui.module.css';
import styles from './portal.module.css';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const call = await memberFnGet('member-orders', '');
  const failed = !call.ok;
  const orders = call.ok ? parseOrders(call.data) : [];

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Product Portal</p>
        <h1 className={ui.title}>Your orders</h1>
        <p className={ui.sub}>Your orders, tracking, and billing in one place.</p>
      </header>

      {failed ? (
        <p className={ui.error}>
          We couldn&apos;t load your orders right now. Check back in a moment.
        </p>
      ) : orders.length === 0 ? (
        <div className={ui.empty}>
          <p>No orders yet. When you order from the label, it shows up here with live tracking.</p>
          <Link href="/tryall" className={ui.quiet}>
            Browse products
          </Link>
        </div>
      ) : (
        orders.map((order) => (
          <section key={order.orderNumber} className={ui.card}>
            <div className={ui.row}>
              <span className={styles.orderNumber}>{order.orderNumber}</span>
              <span className={order.fulfilled ? ui.pillGreen : ui.pillAmber}>
                {order.fulfilled ? 'Shipped' : 'Preparing'}
              </span>
              {order.financialStatus && order.financialStatus !== 'paid' ? (
                <span className={ui.pill}>{order.financialStatus.replace(/_/g, ' ')}</span>
              ) : null}
            </div>
            <ul className={styles.lines}>
              {order.lines.map((line, i) => (
                <li key={i} className={styles.line}>
                  <span>
                    {line.title}
                    {line.variant ? ` — ${line.variant}` : ''}
                    {line.quantity > 1 ? ` ×${line.quantity}` : ''}
                  </span>
                  {line.price ? <span>{formatMoney(line.price, order.currency)}</span> : null}
                </li>
              ))}
            </ul>
            <div className={ui.row}>
              <span className={styles.total}>{formatMoney(order.totalPrice, order.currency)}</span>
              <span className={ui.sub}>Ordered {formatOrderDate(order.orderedAt)}</span>
            </div>
            {order.trackingUrl ? (
              <div className={ui.row}>
                <span className={ui.sub}>
                  {order.trackingCompany ?? 'Carrier'}
                  {order.trackingNumber ? ` · ${order.trackingNumber}` : ''}
                </span>
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ui.link}
                >
                  Track shipment
                </a>
                {order.fulfilledAt ? (
                  <span className={ui.sub}>Shipped {formatOrderDate(order.fulfilledAt)}</span>
                ) : null}
              </div>
            ) : null}
          </section>
        ))
      )}

      {!failed && orders.length > 0 ? (
        <section className={ui.card}>
          <p className={ui.body}>Manage subscriptions, payment methods, and delivery schedules.</p>
          <a
            href={BILLING_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={ui.quiet}
          >
            Launch billing portal
          </a>
        </section>
      ) : null}
    </div>
  );
}
