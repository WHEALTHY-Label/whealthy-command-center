import { describe, expect, it } from 'vitest';
import { parseSkoolResults } from './skool';

describe('parseSkoolResults', () => {
  it('reads the deployed skool-member-search shape', () => {
    const matches = parseSkoolResults({
      results: [
        {
          handle: 'jake-jacobs',
          name: 'Jake Tayler Jacobs',
          avatar_url: 'https://cdn.skool.com/a.jpg',
          found: true,
        },
      ],
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.handle).toBe('jake-jacobs');
    expect(matches[0]!.name).toBe('Jake Tayler Jacobs');
    expect(matches[0]!.avatar_url).toBe('https://cdn.skool.com/a.jpg');
  });

  it('falls back to the handle when the roster row has no full name', () => {
    // The function already substitutes '@handle', but a null name must not
    // render the string "null" under a steward's avatar.
    expect(parseSkoolResults({ results: [{ handle: 'quiet-steward', name: null }] })[0]!.name).toBe(
      'quiet-steward',
    );
  });

  it('drops the avatar when it is null rather than a URL', () => {
    // avatar_url comes back as null (not absent) for members with no photo.
    expect(
      parseSkoolResults({ results: [{ handle: 'no-photo', name: 'No Photo', avatar_url: null }] })[0]!
        .avatar_url,
    ).toBeUndefined();
  });

  it('drops rows with no handle, since the handle is the React key', () => {
    expect(parseSkoolResults({ results: [{ name: 'Nameless' }, { handle: '', name: 'Blank' }] })).toEqual(
      [],
    );
  });

  it('treats an error body, a rate limit, or junk as no results', () => {
    expect(parseSkoolResults({ error: 'rate_limited', results: [], retry_after: 60 })).toEqual([]);
    expect(parseSkoolResults({ results: [], error: 'lookup_failed' })).toEqual([]);
    expect(parseSkoolResults({ results: 'nope' })).toEqual([]);
    expect(parseSkoolResults({})).toEqual([]);
    expect(parseSkoolResults(null)).toEqual([]);
    expect(parseSkoolResults('unexpected')).toEqual([]);
  });

  it('skips non-object entries inside results', () => {
    expect(parseSkoolResults({ results: [null, 'x', 7, { handle: 'real', name: 'Real' }] })).toHaveLength(
      1,
    );
  });
});
