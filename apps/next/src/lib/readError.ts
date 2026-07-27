/**
 * Why a read came back empty, in words a steward can act on.
 *
 * An empty list is not the same fact as a list that failed to load, but the
 * port used to render them identically. `fetchWallView` answered every failure
 * with `[]`, `fetchLedger` did the same, and the screens above them say things
 * like "Every prayer on the wall is being carried." or "Nothing handed over
 * yet." So a steward whose session had expired, or who was offline, or whose
 * member row could not be resolved, was told the wall was quiet and the ledger
 * was empty. He would have believed it.
 *
 * This is the member-facing twin of the admin panel's own `readFailure`. The
 * two are worded differently on purpose: an admin is told "Admin access
 * required", a steward is told what to do next.
 */
export function readReason(status: number, code = ''): string {
  if (status === 401) return 'Your session expired. Sign in again to load this.';
  if (status === 403) return 'Your steward access is not active, so this did not load.';
  if (status === 404) return 'That is not here any more.';
  if (status === 429) return 'That was asked for too many times just now. Give it a minute.';
  // `status: 0` is what the fetch helpers report when the request never
  // reached the function at all: DNS, TLS, a dropped connection.
  if (status === 0) return 'Could not reach the server. Check your connection and retry.';
  return code ? `Could not load this: ${code}` : 'Could not load this. Please retry.';
}
