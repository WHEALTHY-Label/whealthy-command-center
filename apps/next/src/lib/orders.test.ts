import { describe, expect, it } from 'vitest';
import { formatMoney, formatOrderDate, parseOrders } from './orders';

describe('parseOrders', () => {
  it('reads the deployed member-orders shape', () => {
    const orders = parseOrders({
      ok: true,
      count: 1,
      orders: [
        {
          order_number: '#1042',
          financial_status: 'paid',
          fulfillment_status: 'fulfilled',
          line_items: [{ title: 'Charge Powder', variant: 'Cotton Candy', quantity: 2, price: '40.00' }],
          total_price: '89.95',
          currency: 'USD',
          tracking_company: 'USPS',
          tracking_number: '9400',
          tracking_url: 'https://tools.usps.com/x',
          ordered_at: '2026-07-01T12:00:00Z',
          fulfilled_at: '2026-07-03T12:00:00Z',
        },
      ],
    });
    expect(orders).toHaveLength(1);
    const o = orders[0]!;
    expect(o.orderNumber).toBe('#1042');
    expect(o.fulfilled).toBe(true);
    expect(o.lines[0]!.variant).toBe('Cotton Candy');
    expect(o.trackingUrl).toContain('usps');
  });

  it('degrades to empty on junk', () => {
    expect(parseOrders(null)).toEqual([]);
    expect(parseOrders({ ok: true })).toEqual([]);
  });
});

describe('formatMoney', () => {
  it('formats currency and survives junk', () => {
    expect(formatMoney('89.95', 'USD')).toBe('$89.95');
    expect(formatMoney(null, 'USD')).toBe('');
    expect(formatMoney('abc', 'USD')).toBe('abc');
  });
});

describe('formatOrderDate', () => {
  it('formats and survives junk', () => {
    expect(formatOrderDate('2026-07-01T12:00:00Z')).toContain('2026');
    expect(formatOrderDate('junk')).toBe('');
    expect(formatOrderDate(null)).toBe('');
  });
});
