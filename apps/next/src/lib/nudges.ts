/**
 * `rhythm-nudge-check` answers `{ok, nudges:[{kind, copy, slot_id?, title?,
 * product_key?}]}`. The recovered app read `type` and `message`, which never
 * existed, so every toast fell back to a generic line. These names come from
 * the deployed function's source.
 */
export const NUDGE_KINDS = ['slipping', 'fresh_start', 'product_slot'] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

export interface Nudge {
  /** Stable within a batch: the function dedups on the same key for 18 hours. */
  id: string;
  kind: NudgeKind;
  copy: string;
  slotId?: string;
  productKey?: string;
}

function toKind(raw: unknown): NudgeKind | null {
  return typeof raw === 'string' && (NUDGE_KINDS as readonly string[]).includes(raw)
    ? (raw as NudgeKind)
    : null;
}

function str(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}

export interface ParseNudgeOptions {
  /**
   * The fresh-start card is already on the page. Showing the same invitation
   * as a toast on top of it just repeats itself.
   */
  suppressFreshStart?: boolean;
}

/**
 * Parse a nudge-check response into toasts. Unknown kinds and wordless entries
 * are dropped rather than rendered as an empty box, and a kind repeated inside
 * one batch is shown once. Pure.
 */
export function parseNudges(raw: unknown, options: ParseNudgeOptions = {}): Nudge[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const list = (raw as { nudges?: unknown }).nudges;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const out: Nudge[] = [];

  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;

    const kind = toKind(row.kind);
    if (!kind) continue;
    if (kind === 'fresh_start' && options.suppressFreshStart) continue;

    const copy = str(row.copy);
    if (!copy) continue;

    const slotId = str(row.slot_id);
    const id = `${kind}:${slotId ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      kind,
      copy,
      ...(slotId ? { slotId } : {}),
      ...(str(row.product_key) ? { productKey: str(row.product_key) } : {}),
    });
  }

  return out;
}
