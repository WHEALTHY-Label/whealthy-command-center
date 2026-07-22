import { z } from 'zod';

/**
 * Public runtime configuration for the browser bundle.
 *
 * SECURITY: only NEXT_PUBLIC_* values belong here. Anything secret
 * (Supabase service-role key, webhook secrets, admin credentials) is
 * server-only and must never be read through this module, because every
 * value returned here can end up inlined into client JavaScript.
 *
 * Consumed starting in Slice 2 (Supabase browser/SSR clients). Slice 1
 * ships the validated accessor and its tests but does not call it from any
 * rendered route, so the shell build does not require these vars to be set.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_FN_BASE: z.string().url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Pure validation over an arbitrary source object. Throws a readable error
 * that names the offending variables without printing their values.
 */
export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid public environment configuration: ${issues}`);
  }
  return result.data;
}

let cached: PublicEnv | undefined;

/**
 * Validated public env from process.env, memoized. Fails loudly when a
 * required NEXT_PUBLIC_* value is absent or malformed.
 */
export function getPublicEnv(): PublicEnv {
  if (!cached) {
    cached = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_FN_BASE: process.env.NEXT_PUBLIC_FN_BASE,
    });
  }
  return cached;
}
