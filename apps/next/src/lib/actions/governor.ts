'use server';

import { memberFn } from '@/lib/fn';

/**
 * governor-ai wrapper. `task` is the server's dispatch key (its MAX_TOKENS
 * map); the free-text prompt rides alongside. Only the tasks this app
 * actually uses are allowed through.
 */
const TASKS = new Set(['scribe', 'threads', 'bible_study', 'record_wall_nudge']);

export interface GovernorResult {
  ok: boolean;
  out: unknown;
}

export async function askGovernor(
  task: string,
  prompt: string,
  context?: Record<string, unknown>,
): Promise<GovernorResult> {
  if (!TASKS.has(task)) return { ok: false, out: null };
  const call = await memberFn('governor-ai', {
    task,
    prompt: prompt.slice(0, 8000),
    ...(context ? { context } : {}),
  });
  if (!call.ok || call.data.ok !== true) return { ok: false, out: null };
  return { ok: true, out: call.data.out ?? null };
}
