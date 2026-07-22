import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';

/**
 * Browser Supabase client. Uses only the publishable anon key. Never holds
 * or references the service-role key. Authorization is enforced server-side
 * and by RLS, not here.
 */
export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
