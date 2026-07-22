import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';

/**
 * Refreshes the Supabase session on every request and resolves the
 * authenticated user server-side with getUser() (which revalidates the token
 * against Supabase rather than trusting the cookie's contents).
 *
 * Returns the response (with refreshed cookies) and the authenticated email,
 * or null when there is no valid session.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  email: string | null;
}> {
  let response = NextResponse.next({ request });

  const env = getPublicEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, email: user?.email ?? null };
}
