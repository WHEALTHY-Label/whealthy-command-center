import 'server-only';
import { cache } from 'react';
import { toAdminRole, type AdminRole } from '@/lib/auth/roles';
import { safeAvatarUrl } from '@/lib/sidebar';
import { createClient } from '@/lib/supabase/server';
import { fetchMemberProfile } from '@/lib/tour';

/**
 * The validated session user, once per request.
 *
 * `getUser()` revalidates the token against Supabase over the network, and the
 * protected shell now asks three separate questions of it (the email, the
 * avatar in the rail, the avatar on the welcome card). Caching here makes that
 * one round trip instead of three without any caller having to thread a user
 * object through.
 */
const currentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The authenticated user's email, resolved server-side via getUser() (which
 * revalidates the token against Supabase). Returns null when there is no
 * valid session. Never derives identity from client input or from the
 * user-editable user_metadata.
 */
export async function getAuthedEmail(): Promise<string | null> {
  const user = await currentUser();
  return user?.email ?? null;
}

export type { AdminRole };

/**
 * The steward's Skool profile photo, for the rail and the welcome card.
 *
 * This is the one thing the app reads off `user_metadata`, and it is read for
 * pixels only: `waPaintAvatar` at index.html:12035 did exactly the same, and
 * `waSafeAvatarUrl` (11999) is reproduced in `safeAvatarUrl` so a steward who
 * edits his own metadata can still only point the tag at Skool over https.
 * Identity keeps coming from `getUser().email` and nothing else.
 */
export async function getAvatarUrl(): Promise<string | null> {
  const user = await currentUser();
  return safeAvatarUrl(user?.user_metadata?.skool_avatar_url);
}

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
