import { describe, expect, it } from 'vitest';
import { describeAuthError } from './auth-errors';

describe('describeAuthError', () => {
  it('names the rate limit rather than telling the steward to just try again', () => {
    expect(describeAuthError('Email rate limit exceeded', 429)).toMatch(/wait about an hour/i);
    expect(describeAuthError('anything', 429)).toMatch(/wait about an hour/i);
    expect(describeAuthError('too many requests')).toMatch(/wait about an hour/i);
  });

  it('names missing email sending, the likeliest failure on a fresh project', () => {
    expect(describeAuthError('Error sending confirmation email')).toMatch(
      /not set up on this project/i,
    );
    expect(describeAuthError('SMTP provider returned 535')).toMatch(/not set up on this project/i);
  });

  it('separates a disabled signup from a delivery failure', () => {
    expect(describeAuthError('Signups not allowed for otp')).toMatch(/not set up for sign-in/i);
    expect(describeAuthError('Signup is disabled')).toMatch(/not set up for sign-in/i);
  });

  it('points at the address when the address is what was rejected', () => {
    expect(describeAuthError('Unable to validate email address: invalid format')).toMatch(/typos/i);
  });

  it('passes an unrecognised message through instead of swallowing it', () => {
    expect(describeAuthError('Database error saving new user')).toBe(
      'Could not send the code. Database error saving new user',
    );
  });

  it('prefers the rate-limit status over the message text', () => {
    // A 429 whose body mentions SMTP is still a rate limit, not a config gap.
    expect(describeAuthError('smtp queue full', 429)).toMatch(/wait about an hour/i);
  });
});
