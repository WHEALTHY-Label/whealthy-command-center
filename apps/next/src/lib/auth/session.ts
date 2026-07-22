import 'server-only';
import { createClient } from '@/lib/supabase/server';

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

/**
 * The caller's admin role, read from the authoritative server-side source
 * (approved_members.admin_role), keyed by the validated session email.
 *
 * Slice 2 only proves the role is resolvable server-side. Admin AUTHORIZATION
 * enforcement is deferred to Slice 8 per the migration plan, so nothing in
 * this slice grants access based on this value.
 */
export type AdminRole = 'master' | 'admin' | 'moderator' | null;

export async function getAdminRole(): Promise<AdminRole> {
  const email = await getAuthedEmail();
  if (!email) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('approved_members')
    .select('admin_role')
    .eq('email', email)
    .maybeSingle();
  if (error || !data) return null;
  const role = (data as { admin_role?: unknown }).admin_role;
  return role === 'master' || role === 'admin' || role === 'moderator' ? role : null;
}
