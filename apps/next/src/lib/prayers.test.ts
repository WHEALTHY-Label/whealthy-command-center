import { describe, expect, it } from 'vitest';
import { HIO_CATEGORIES, hioCategory, parseLedger } from './prayers';

describe('parseLedger', () => {
  it('reads the deployed default view: a bare array with computed status', () => {
    const items = parseLedger([
      {
        id: 'p1',
        body: 'The mortgage.',
        category: 'money',
        created_at: '2026-07-20T10:00:00Z',
        status: 'lifted',
        pray_count: 5,
        outcome: null,
        closed_on: null,
      },
      {
        id: 'p2',
        body: 'Mom recovery.',
        category: 'health',
        created_at: '2026-07-01T10:00:00Z',
        status: 'answered',
        pray_count: 0,
        outcome: 'She walked out on Tuesday.',
        closed_on: '2026-07-15',
      },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]!.status).toBe('lifted');
    expect(items[0]!.prayCount).toBe(5);
    expect(items[1]!.status).toBe('answered');
    expect(items[1]!.outcome).toBe('She walked out on Tuesday.');
  });

  it('accepts the legacy {handovers} wrapper and defaults unknown status to private', () => {
    const items = parseLedger({ handovers: [{ id: 1, body: 'x', status: 'weird' }] });
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe('private');
  });

  it('degrades to empty on junk', () => {
    expect(parseLedger(null)).toEqual([]);
    expect(parseLedger({})).toEqual([]);
  });
});

describe('hioCategory', () => {
  it('has the six doors with led prayers and scripture anchors', () => {
    expect(HIO_CATEGORIES).toHaveLength(6);
    expect(hioCategory('money').scriptureRef).toBe('Matthew 6:33');
    expect(hioCategory('head').scriptureRef).toBe('Isaiah 26:3');
  });
  it('falls back to freeform for unknown keys', () => {
    expect(hioCategory('nope').key).toBe('freeform');
  });
});
