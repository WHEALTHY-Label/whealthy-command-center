/**
 * Turn a Supabase auth failure into something a steward (or Ignacio, testing)
 * can act on.
 *
 * The generic "please try again" the sign-in action used to return hid the two
 * failures that actually happen here, and both are project configuration
 * rather than anything the person typed:
 *
 *   - No custom SMTP on the Supabase project. The built-in sender only
 *     delivers to project team members and allows roughly two per hour, so
 *     every other steward gets a silent nothing.
 *   - Rate limit hit while testing repeatedly from one address.
 *
 * Lives outside the `'use server'` module on purpose: every export of a server
 * action file must be an async function, so a pure helper cannot sit there.
 */
export function describeAuthError(message: string, status?: number): string {
  const m = message.toLowerCase();
  if (status === 429 || m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many codes requested. Wait about an hour, or use a different email.';
  }
  if (m.includes('smtp') || m.includes('error sending') || m.includes('confirmation email')) {
    return 'The code could not be emailed. Email sending is not set up on this project yet.';
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'This email is not set up for sign-in yet.';
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'That email address was rejected. Check it for typos.';
  }
  return `Could not send the code. ${message}`;
}
