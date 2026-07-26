import { describe, expect, it } from 'vitest';
import { parseNudges } from './nudges';

describe('parseNudges', () => {
  it('reads the field names the deployed function actually sends', () => {
    // `kind` and `copy`, not `type` and `message`.
    const nudges = parseNudges({
      ok: true,
      nudges: [
        {
          kind: 'slipping',
          slot_id: 's1',
          title: 'Morning walk',
          copy: 'Your morning walk slipped a little this week. Pick it back up when you can.',
        },
        {
          kind: 'product_slot',
          slot_id: 's2',
          product_key: 'genius_joe',
          copy: 'Your morning governance slot is set. Genius Joe covers it when you are ready.',
        },
      ],
    });

    expect(nudges).toHaveLength(2);
    expect(nudges[0]?.id).toBe('slipping:s1');
    expect(nudges[0]?.copy).toContain('Pick it back up');
    expect(nudges[1]?.productKey).toBe('genius_joe');
  });

  it('suppresses the fresh-start toast when the card already says it', () => {
    const payload = {
      nudges: [{ kind: 'fresh_start', copy: 'A new week. A clean page to carry well.' }],
    };
    expect(parseNudges(payload)).toHaveLength(1);
    expect(parseNudges(payload, { suppressFreshStart: true })).toEqual([]);
  });

  it('drops unknown kinds and wordless entries rather than rendering an empty toast', () => {
    expect(
      parseNudges({
        nudges: [
          { kind: 'unknown_kind', copy: 'Something new the server added.' },
          { kind: 'slipping', slot_id: 's1', copy: '   ' },
          { kind: 'slipping', slot_id: 's2' },
          null,
          'nope',
        ],
      }),
    ).toEqual([]);
  });

  it('shows one toast per kind and slot inside a batch', () => {
    const nudges = parseNudges({
      nudges: [
        { kind: 'slipping', slot_id: 's1', copy: 'First.' },
        { kind: 'slipping', slot_id: 's1', copy: 'Duplicate.' },
        { kind: 'slipping', slot_id: 's2', copy: 'A different anchor.' },
      ],
    });
    expect(nudges.map((n) => n.id)).toEqual(['slipping:s1', 'slipping:s2']);
    expect(nudges[0]?.copy).toBe('First.');
  });

  it('degrades to nothing on a shape it does not recognise', () => {
    expect(parseNudges(null)).toEqual([]);
    expect(parseNudges({ ok: true })).toEqual([]);
    expect(parseNudges({ nudges: 'none' })).toEqual([]);
    expect(parseNudges('nope')).toEqual([]);
  });
});
