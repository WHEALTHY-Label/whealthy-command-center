import { redirect } from 'next/navigation';
import { getAdminRole } from '@/lib/auth/session';

/**
 * Server-side admin gate. The edge functions enforce authorization on every
 * call via the JWT's admin_role; this layer keeps the pages themselves off
 * non-admin screens instead of merely hiding the nav item.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getAdminRole();
  if (role === null) {
    redirect('/');
  }
  return <>{children}</>;
}
