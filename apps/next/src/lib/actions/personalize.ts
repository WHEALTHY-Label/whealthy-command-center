'use server';

import { askGovernor } from '@/lib/actions/governor';
import { getAuthedEmail } from '@/lib/auth/session';
import { day365, parseProgressRow, streak365 } from '@/lib/bible';
import { fetchRhythmStatus, parseGovernorFast } from '@/lib/dashboard';
import { memberFn } from '@/lib/fn';
import {
  bibleContextLine,
  buildSynthesisPrompt,
  fastContextLine,
  habitsContextLine,
  journalContextLine,
  parseJournalEntries,
  parsePersonalization,
  type Personalization,
} from '@/lib/personalize';
import { createClient } from '@/lib/supabase/server';
import { chicagoToday } from '@/lib/today';
import { fetchMemberProfile } from '@/lib/tour';

export interface PersonalizationResult {
  ok: boolean;
  personalization: Personalization | null;
}

const NOTHING: PersonalizationResult = { ok: false, personalization: null };

/**
 * The dashboard's AI personalization call, task `synthesis`.
 *
 * The legacy app built this prompt in the browser out of whatever globals
 * happened to be loaded (`window.S`, `window.REC`, `window.whBibleState`, the
 * habit checkboxes in the DOM). Here the context is gathered server side from
 * the same functions that render the page, so it does not depend on which
 * screens the steward has visited this session.
 *
 * `localHour` comes from the browser because it is the one fact the server
 * cannot know: the greeting is the steward's local time of day, not the
 * server's. `allowCommunity` likewise comes from the browser, where the five
 * day nudge stamp lives in localStorage. Both only shape the prompt. The
 * deployed function still gates the wall nudge on real wall counts, so a
 * client that lies about the stamp cannot manufacture a nudge.
 */
export async function fetchDashPersonalization(
  localHour: number,
  allowCommunity: boolean,
): Promise<PersonalizationResult> {
  const email = await getAuthedEmail();
  if (!email) return NOTHING;

  const hour = Number.isFinite(localHour) ? Math.min(23, Math.max(0, Math.floor(localHour))) : 0;
  // The calendar day is Chicago, matching `realToday()`; only the hour above is
  // the steward's own, because the greeting is about his time of day.
  const today = chicagoToday();

  const supabase = await createClient();
  const [{ data: userData }, profile, rhythm, state] = await Promise.all([
    supabase.auth.getUser(),
    fetchMemberProfile(email),
    fetchRhythmStatus(email),
    // One load carries both the journal entries and the fast row.
    memberFn('governor-state', { action: 'load' }),
  ]);

  const user = userData.user;
  // `bible_progress` is the one table `authenticated` is actually granted on,
  // with own-row policies, so this session-scoped read is legitimate.
  const progressRow = user
    ? await supabase
        .from('bible_progress')
        .select('start_date, completed_days, streak')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };
  const progress = parseProgressRow(progressRow.data);
  const bible = progress
    ? {
        // The stored streak is authoritative when it is there; recompute only
        // as a fallback so a row written before the column existed still says
        // something true.
        streak:
          progress.streak > 0
            ? progress.streak
            : streak365(progress.completed, day365(progress.startDate, today)),
        completedToday: progress.completed.includes(day365(progress.startDate, today)),
      }
    : null;

  const entries = state.ok ? parseJournalEntries(state.data) : [];
  const fast = state.ok ? parseGovernorFast(state.data.fast, today) : null;
  const keptSlots = rhythm.slots.filter((s) => s.done === true).length;

  const name = profile.firstName.length > 0 ? profile.firstName : 'Steward';
  const archetype = profile.archetypeName.length > 0 ? profile.archetypeName : 'Steward';

  const prompt = buildSynthesisPrompt({
    name,
    archetype,
    hour,
    fastInfo: fastContextLine(fast),
    bibleInfo: bibleContextLine(bible),
    habitsInfo: habitsContextLine(keptSlots, rhythm.slots.length),
    journalContext: journalContextLine(entries),
  });

  const answer = await askGovernor('synthesis', prompt, {
    ...(allowCommunity ? { allowCommunityDirective: true } : {}),
  });
  if (!answer.ok) return NOTHING;
  const personalization = parsePersonalization(answer.out);
  if (!personalization) return NOTHING;
  return { ok: true, personalization };
}
