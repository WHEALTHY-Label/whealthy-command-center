import { createClient } from '@/lib/supabase/server';
import { memberFn } from '@/lib/fn';
import { broughtPrayerToday, parseMarks, parseProgressRow } from '@/lib/bible';
import { fetchWallView } from '@/lib/actions/wall';
import { chicagoToday } from '@/lib/today';
import { BibleClient } from './BibleClient';
import ui from '@/components/ui.module.css';

export const dynamic = 'force-dynamic';

export default async function BiblePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Day N of 365 is counted in Chicago. The live app counted it on the device
  // clock (`getTodayDayNumber()` at index.html:9553), which a server cannot
  // know; Chicago is closer than UTC for every steward here, it is the calendar
  // the rest of the app is dated in, and the only stored value it moves is
  // `bible_progress.streak`, which is a recomputable cache rather than a ledger.
  const today = chicagoToday();

  const [progressRow, stateCall, marksCall, feedCall, mineCall] = await Promise.all([
    user
      ? supabase
          .from('bible_progress')
          .select('start_date, completed_days, streak')
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    memberFn('my-bible-state', { action: 'get' }),
    memberFn('my-bible-marks', { action: 'list' }),
    // The sanctuary prayer drawer, rendered from the wall rather than from a
    // second store of the same prayers.
    fetchWallView('bible365', 0, 10),
    fetchWallView('my_prayers', 0, 20),
  ]);

  const progress = parseProgressRow(progressRow.data);
  const state =
    stateCall.ok && typeof stateCall.data.state === 'object' && stateCall.data.state !== null
      ? (stateCall.data.state as Record<string, unknown>)
      : null;
  const spot = state
    ? {
        book: typeof state.book === 'string' ? state.book : 'Matthew',
        chapter: typeof state.chapter === 'number' ? state.chapter : 1,
        verse: typeof state.verse === 'number' ? state.verse : null,
        mode: state.mode === 'bible_365' ? ('bible_365' as const) : ('my_bible' as const),
      }
    : null;
  const marks = marksCall.ok ? parseMarks(marksCall.data) : [];

  return (
    <div className={ui.page}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>Scripture</p>
        <h1 className={ui.title}>The Word</h1>
        <p className={ui.sub}>
          Bible 365 walks the whole Bible in a year. My Bible is every book, every chapter, with
          your own marks.
        </p>
      </header>
      <BibleClient
        progress={progress}
        spot={spot}
        initialMarks={marks}
        today={today}
        prayerFeed={feedCall.posts}
        prayerFeedError={feedCall.error ?? null}
        broughtPrayerToday={broughtPrayerToday(mineCall.posts, today)}
      />
    </div>
  );
}
