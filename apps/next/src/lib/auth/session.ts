import 'server-only';
import { toAdminRole, type AdminRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { fetchMemberProfile } from '@/lib/tour';

/**
 * The authenticated user's email, resolved server-side via getUser() (which
 * revalidates the token against Supabase). Returns null when there is no
 * valid session. Never derives identity from client input or from the
 * user-editable user_metadata.
 */
export async function getAuthedEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export type { AdminRole };

/**
 * The caller's admin role, keyed by the validated session email.
 *
 * This MUST go through `verify-member` rather than reading
 * `approved_members.admin_role` directly. That table has row level security on
 * with no SELECT policy and no grant to the `authenticated` role, so a
 * session-scoped select does not return an empty result, it raises
 * `42501 permission denied`. The previous direct read therefore returned null
 * for every user including Ignacio (`admin_role = 'master'`), which locked the
 * whole Control Panel behind a redirect and hid the admin link in the sidebar.
 *
 * The legacy app read the same value from the same function
 * (index.html:12491 sets `window.ADMIN_ROLE = vd.admin_role || null`), so this
 * is parity, not a workaround. `fetchMemberProfile` is request-cached, so the
 * layout's parallel `getAdminRole()` + `fetchMemberProfile()` pair still costs
 * one round trip.
 */
export async function getAdminRole(): Promise<AdminRole> {
  const email = await getAuthedEmail();
  if (!email) return null;
  const profile = await fetchMemberProfile(email);
  return toAdminRole(profile.adminRole);
}
