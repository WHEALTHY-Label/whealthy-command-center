/**
 * Product Portal order parsing against the deployed `member-orders` response:
 * { ok, count, orders: [{ order_number, financial_status, fulfillment_status,
 *   line_items, total_price, currency, tracking_company, tracking_number,
 *   tracking_url, ordered_at, fulfilled_at }] }.
 */

export interface OrderLine {
  title: string;
  variant: string | null;
  quantity: number;
  price: string | null;
}

export interface MemberOrder {
  orderNumber: string;
  financialStatus: string | null;
  fulfilled: boolean;
  lines: OrderLine[];
  totalPrice: string | null;
  currency: string;
  trackingCompany: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  orderedAt: string | null;
  fulfilledAt: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

export function parseOrders(data: unknown): MemberOrder[] {
  if (typeof data !== 'object' || data === null) return [];
  const orders = (data as Record<string, unknown>).orders;
  if (!Array.isArray(orders)) return [];
  return orders
    .filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null)
    .map((o) => {
      const rawLines = Array.isArray(o.line_items) ? o.line_items : [];
      const lines: OrderLine[] = rawLines
        .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null)
        .map((l) => ({
          title: str(l.title) ?? 'Item',
          variant: str(l.variant),
          quantity: typeof l.quantity === 'number' ? l.quantity : 1,
          price: str(l.price) ?? (typeof l.price === 'number' ? String(l.price) : null),
        }));
      return {
        orderNumber: String(o.order_number ?? ''),
        financialStatus: str(o.financial_status),
        fulfilled: o.fulfillment_status === 'fulfilled',
        lines,
        totalPrice: str(o.total_price) ?? (typeof o.total_price === 'number' ? String(o.total_price) : null),
        currency: str(o.currency) ?? 'USD',
        trackingCompany: str(o.tracking_company),
        trackingNumber: str(o.tracking_number),
        trackingUrl: str(o.tracking_url),
        orderedAt: str(o.ordered_at),
        fulfilledAt: str(o.fulfilled_at),
      };
    });
}

export function formatMoney(amount: string | null, currency: string): string {
  if (amount === null) return '';
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function formatOrderDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
