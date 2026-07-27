'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthedEmail } from '@/lib/auth/session';
import { publicFn } from '@/lib/fn';
import { CC_BUNDLES } from '@/lib/catalog';
import { fetchMemberProfile } from '@/lib/tour';
import {
  answersPayload,
  derivedProfile,
  isComplete,
  PATTERN_NAMES,
  runQuizScoring,
  type QuizAnswers,
  type QuizScore,
} from '@/lib/quiz';

/**
 * The Steward Pattern submission.
 *
 * Two deliberate departures from the standalone quiz:
 *
 * 1. No contact gate. The standalone page had to ask for an email because it
 *    ran unauthenticated on the marketing site. In here the member is already
 *    signed in, so the email is the validated session email and can never be
 *    supplied by the caller. The first name comes from the member row.
 * 2. Scoring runs server side. The live page scored in the browser and posted
 *    the verdict, so a crafted request could name its own pattern and bundle.
 *    Here the client sends only raw answers; the cascade runs here.
 *
 * `add-member` is the same endpoint the standalone quiz posts to, and it is
 * intentionally unauthenticated (it validates and rate limits server side), so
 * `publicFn` is correct here rather than `memberFn`.
 */

/** Raw answers only. Nothing derived is accepted from the client. */
const answersSchema = z.object({
  shape: z.number().int().min(0).max(2).optional(),
  peakBlock: z
    .enum(['early-morning', 'late-morning', 'midday', 'afternoon', 'evening'])
    .optional(),
  resource: z.number().int().min(0).max(1).optional(),
  timescale: z.number().int().min(0).max(2).optional(),
  input: z.number().int().min(0).max(3).optional(),
  source: z.number().int().min(0).max(2).optional(),
  history: z.number().int().min(0).max(3).optional(),
  leaning: z.number().int().min(0).max(4).optional(),
  season: z.number().int().min(0).max(3).optional(),
  matters: z.number().int().min(0).max(3).optional(),
  govern: z.array(z.number().int().min(0).max(4)).max(5).optional(),
  looking: z.number().int().min(0).max(1).optional(),
  carrying: z.string().max(2000).optional(),
});

export interface QuizSubmitResult {
  ok: boolean;
  error?: string;
  score?: QuizScore;
  bundleName?: string;
  /** True when add-member reported the Skool invite hook fired. */
  invited?: boolean;
}

function bundleNameFor(key: string): string {
  return CC_BUNDLES.find((b) => b.key === key)?.name ?? '';
}

/**
 * Score the answers and write the member row.
 *
 * The payload mirrors the standalone quiz field for field so existing rows,
 * the CRM sync and the Zapier invite hook all keep matching. Three fields are
 * known to be dropped by the current `add-member`: `identity_anchor` (it sends
 * a pathway, which is not in the function's anchor allowlist), `scores` (the
 * v2 signals are booleans, and the function only accepts numeric archetype
 * scores) and `answers` (the function's allowlist still names the v1 keys).
 * They are sent anyway, unchanged, so widening the allowlist server side is
 * the only change needed to start persisting them.
 */
export async function submitQuiz(raw: unknown): Promise<QuizSubmitResult> {
  const email = await getAuthedEmail();
  if (!email) return { ok: false, error: 'Not signed in.' };

  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Some answers did not come through. Step back and retry.' };
  }
  const answers: QuizAnswers = parsed.data;
  if (!isComplete(answers)) {
    return { ok: false, error: 'A few questions are still open.' };
  }

  const score = runQuizScoring(answers);
  const demo = derivedProfile(answers);
  const bundleName = bundleNameFor(score.bundleKey);
  const patternName = PATTERN_NAMES[score.pattern];

  const profile = await fetchMemberProfile(email);
  const firstName = profile.firstName || 'Steward';

  const call = await publicFn('add-member', {
    event: 'quiz_complete',
    source: 'quiz',
    first_name: firstName,
    last_name: '',
    email,
    pattern: score.pattern,
    pattern_name: patternName,
    pathway: score.pathway,
    archetype: score.pattern,
    archetype_name: patternName,
    identity_anchor: score.pathway,
    bundle_key: score.bundleKey,
    bundle_name: bundleName,
    price: 'free',
    price_interval: 'community',
    ...demo,
    identity_profile: score.identityProfile,
    load_score: score.loadScore,
    load_season: score.loadSeason,
    peak_block: score.peakBlock ?? '',
    skeptical_flag: score.skepticalFlag,
    scores: score.signals,
    answers: answersPayload(answers),
  });

  if (!call.ok) {
    return {
      ok: false,
      error:
        call.status === 429
          ? 'That came through more than once. Give it ten minutes and try again.'
          : 'That did not save. Please try again.',
    };
  }

  // The gate reads `approved_members.archetype`, so this write is what moves
  // the member from the quiz gate to the bundle gate. Revalidate the shell so
  // the next navigation sees it.
  revalidatePath('/', 'layout');

  return {
    ok: true,
    score,
    bundleName,
    invited: call.data.invited === true,
  };
}
