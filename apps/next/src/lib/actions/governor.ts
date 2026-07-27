'use server';

import { memberFn } from '@/lib/fn';

/**
 * governor-ai wrapper. `task` is the server's dispatch key (its MAX_TOKENS
 * map); the free-text prompt rides alongside. Only the tasks this app
 * actually uses are allowed through, and the server rejects anything else
 * with unknown_task regardless.
 *
 * `scripture_whitelist` is a TOP LEVEL field, not part of `context`. The
 * server rejects any generated reference outside it and retries once, so
 * omitting it on a scripture task means the retry can never succeed.
 */
const TASKS = new Set([
  'scribe',
  'threads',
  'bible_study',
  'record_wall_nudge',
  'fast_identity',
  'fast_schedule',
  'fast_phases',
  'fast_scripture',
  'phase_brief',
  // The two the Governor dock needs. Both are in the deployed function's
  // MAX_TOKENS map and each swaps in its own system prompt server side:
  // ROUTER_SYSTEM for intent_router, PROFILE_SYSTEM for profile_update.
  'intent_router',
  'profile_update',
]);

export interface GovernorResult {
  ok: boolean;
  out: unknown;
}

export interface GovernorOptions {
  context?: Record<string, unknown>;
  scriptureWhitelist?: string[];
  allowCommunityDirective?: boolean;
}

export async function askGovernor(
  task: string,
  prompt: string,
  opts: GovernorOptions = {},
): Promise<GovernorResult> {
  if (!TASKS.has(task)) return { ok: false, out: null };
  const call = await memberFn('governor-ai', {
    task,
    prompt: prompt.slice(0, 8000),
    ...(opts.context ? { context: opts.context } : {}),
    ...(opts.scriptureWhitelist ? { scripture_whitelist: opts.scriptureWhitelist } : {}),
    ...(opts.allowCommunityDirective ? { allow_community_directive: true } : {}),
  });
  if (!call.ok || call.data.ok !== true) return { ok: false, out: null };
  return { ok: true, out: call.data.out ?? null };
}
