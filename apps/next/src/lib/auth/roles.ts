/**
 * Admin role vocabulary and the one coercion that reads it.
 *
 * Kept in its own module, with no `server-only` marker and no Next imports, so
 * the coercion can be unit tested directly and so client components can hold
 * the type without dragging the session helpers into the browser bundle.
 */
export type AdminRole = 'master' | 'admin' | 'moderator' | null;

const ROLES = new Set(['master', 'admin', 'moderator']);

/**
 * Narrow whatever `verify-member` reported as `admin_role` to the three roles
 * the app understands. Anything else, including the empty string the function
 * used to send for non-admins, becomes null.
 */
export function toAdminRole(raw: unknown): AdminRole {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return ROLES.has(v) ? (v as Exclude<AdminRole, null>) : null;
}
