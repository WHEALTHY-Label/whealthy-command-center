import { describe, expect, it } from 'vitest';
import { readReason } from './readError';

describe('readReason', () => {
  it('tells an expired session to sign in again', () => {
    expect(readReason(401, 'not_signed_in')).toBe(
      'Your session expired. Sign in again to load this.',
    );
  });

  it('names inactive steward access on a 403', () => {
    expect(readReason(403)).toBe('Your steward access is not active, so this did not load.');
  });

  it('treats a 404 as gone rather than broken', () => {
    expect(readReason(404)).toBe('That is not here any more.');
  });

  it('asks for patience on a 429', () => {
    expect(readReason(429)).toBe('That was asked for too many times just now. Give it a minute.');
  });

  it('reads status 0 as a connection failure, not a server refusal', () => {
    // The fetch helpers in `fn.ts` and `wall.ts` both report `status: 0` from
    // their catch blocks, meaning the request never reached the function.
    expect(readReason(0)).toBe('Could not reach the server. Check your connection and retry.');
  });

  it('passes an unrecognised status through with its code', () => {
    expect(readReason(500, 'server_error')).toBe('Could not load this: server_error');
  });

  it('falls back to a plain retry when there is no code', () => {
    expect(readReason(500)).toBe('Could not load this. Please retry.');
    expect(readReason(418, '')).toBe('Could not load this. Please retry.');
  });

  it('never returns an empty string', () => {
    for (const status of [0, 200, 301, 400, 401, 403, 404, 409, 429, 500, 502, 503]) {
      expect(readReason(status).length).toBeGreaterThan(0);
    }
  });

  /**
   * A 200 should never reach here, but if a caller ever inverts its guard the
   * steward must still see words rather than a blank banner.
   */
  it('handles a success status defensively', () => {
    expect(readReason(200)).toBe('Could not load this. Please retry.');
  });
});
