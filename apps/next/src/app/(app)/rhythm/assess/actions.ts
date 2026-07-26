'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthedEmail } from '@/lib/auth/session';
import { getPublicEnv } from '@/lib/env';
import { buildAssessPayload, RMEQ_COUNT, type Chronotype } from '@/lib/assessment';

const clock = z.string().regex(/^\d{2}:\d{2}$/);

/**
 * Everything the client may send. Anything outside this shape is rejected
 * before it reaches the edge function; identity is never taken from the
 * client, only from the validated session.
 */
const answersSchema = z.object({
  rmeq: z.array(z.number().int().min(0).max(6).nullable()).length(RMEQ_COUNT),
  wakeTime: z.union([clock, z.literal('')]),
  sleepTime: z.union([clock, z.literal('')]),
  workStart: z.union([clock, z.literal('')]),
  workEnd: z.union([clock, z.literal('')]),
  workDays: z.array(z.number().int().min(1).max(7)).max(7),
  remote: z.boolean(),
  nonNegotiables: z
    .array(z.object({ label: z.string().max(120), when: z.string().max(120) }))
    .max(10),
  familyAnchors: z
    .array(
      z.object({
        type: z.enum(['date_night', 'kids', 'spouse', 'meal']),
        when: z.string().max(120),
      }),
    )
    .max(10),
  accountability: z.enum(['self', 'partner', 'group']).nullable(),
  fastingOptIn: z.boolean(),
  fastingWindow: z.string().max(120),
});

export interface AssessResult {
  ok: boolean;
  error?: string;
  chronotype?: Chronotype | null;
}

function toChronotype(value: unknown): Chronotype | null {
  return value === 'morning' || value === 'intermediate' || value === 'evening' ? value : null;
}

/**
 * Save the assessment. The steward's five rMEQ answers are sent as point
 * values; `rhythm-assess` sums them and derives the chronotype server-side, so
 * the classification is never something the client can assert.
 */
export async function submitAssessment(raw: unknown): Promise<AssessResult> {
  const email = await getAuthedEmail();
  if (!email) return { ok: false, error: 'Not signed in.' };

  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Some answers were missing. Please step back through and retry.' };
  }
  if (parsed.data.rmeq.some((n) => n === null)) {
    return { ok: false, error: 'Please answer all five questions.' };
  }

  const env = getPublicEnv();
  const body = buildAssessPayload(parsed.data);

  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_FN_BASE}/rhythm-assess?email=${encodeURIComponent(email)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      return { ok: false, error: 'That did not save. Please try again.' };
    }
    const data = (await res.json()) as Record<string, unknown>;
    revalidatePath('/rhythm');
    return { ok: true, chronotype: toChronotype(data.chronotype) };
  } catch {
    return { ok: false, error: 'That did not save. Please try again.' };
  }
}
