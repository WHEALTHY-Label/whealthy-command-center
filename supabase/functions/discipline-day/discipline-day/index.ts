import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function getDayIndex(startDateStr: string, currentDateStr: string): number {
  const d1 = new Date(startDateStr + "T00:00:00Z");
  const d2 = new Date(currentDateStr + "T00:00:00Z");
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

function getMondayStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getTime());
  monday.setUTCDate(diff);
  return monday.toISOString().split('T')[0];
}

function toChicagoDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function calculateChain(
  keptDates: Set<string>,
  earliestDateStr: string,
  endDateStr: string
): { current: number; longest: number; graced_days: string[] } {
  if (earliestDateStr > endDateStr) {
    return { current: 0, longest: 0, graced_days: [] };
  }

  let current = 0;
  let longest = 0;
  const graced_days: string[] = [];
  const weekGraceUsed = new Set<string>();

  let currentDate = new Date(earliestDateStr + "T00:00:00Z");
  const end = new Date(endDateStr + "T00:00:00Z");

  while (currentDate <= end) {
    const dStr = currentDate.toISOString().split('T')[0];
    const isKept = keptDates.has(dStr);

    if (isKept) {
      current++;
      if (current > longest) {
        longest = current;
      }
    } else {
      // If it is the last day in the range (today), do not treat it as a miss yet
      if (dStr === endDateStr) {
        break;
      }

      // Missed day. Check calendar week (Monday-Sunday) grace.
      const mondayStr = getMondayStr(dStr);
      if (!weekGraceUsed.has(mondayStr)) {
        weekGraceUsed.add(mondayStr);
        graced_days.push(dStr);
        current++; // Chain holds and increments
        if (current > longest) {
          longest = current;
        }
      } else {
        // Second miss. Reset streak.
        current = 0;
      }
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return {
    current,
    longest,
    graced_days
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, from, to } = await req.json();

    if (!email || !from || !to) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, from, to' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromMs = new Date(from + "T00:00:00Z").getTime();
    const toMs = new Date(to + "T00:00:00Z").getTime();
    if (isNaN(fromMs) || isNaN(toMs)) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dayDiff = Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24)) + 1;
    if (dayDiff > 92) {
      return new Response(JSON.stringify({ error: 'Range exceeds 92 days' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (dayDiff < 1) {
      return new Response(JSON.stringify({ error: 'Invalid date range' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cleanEmail = email.trim().toLowerCase();
    const { data: member, error: memberError } = await supabase
      .from('approved_members')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!member) {
      return new Response(JSON.stringify({
        days: [],
        today: { date: to, word: false, prayer: false, fast: null, record: false },
        last_active: { word: null, prayer: null, fast: null, record: null },
        chains: {
          word: { current: 0, longest: 0, graced_days: [] },
          prayer: { current: 0, longest: 0, graced_days: [] },
          fast: { current: 0, longest: 0, graced_days: [] },
          record: { current: 0, longest: 0, graced_days: [] },
          rhythm: { current: 0, longest: 0, graced_days: [] }
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const memberId = member.id;

    const [bibleRes, wallPraysRes, prayersRes, fastsRes, recordEntriesRes] = await Promise.all([
      supabase.from('bible_progress').select('start_date, completed_days, streak').eq('email', cleanEmail).maybeSingle(),
      supabase.from('wall_prays').select('created_at').eq('member_id', memberId),
      supabase.from('prayers').select('asked_on, created_at').eq('member_id', memberId),
      supabase.from('fasts').select('id, start_date, duration, status, ended_day').eq('member_email', cleanEmail).neq('status', 'discarded'),
      supabase.from('record_entries').select('entry_date, fast_id, fast_day, burned').eq('member_email', cleanEmail)
    ]);

    if (bibleRes.error) throw new Error(bibleRes.error.message);
    if (wallPraysRes.error) throw new Error(wallPraysRes.error.message);
    if (prayersRes.error) throw new Error(prayersRes.error.message);
    if (fastsRes.error) throw new Error(fastsRes.error.message);
    if (recordEntriesRes.error) throw new Error(recordEntriesRes.error.message);

    const bp = bibleRes.data;
    const wp = wallPraysRes.data || [];
    const pr = prayersRes.data || [];
    const fs = fastsRes.data || [];
    const re = recordEntriesRes.data || [];

    // 1. Reconstruct kept dates and find the earliest kept date for each
    const wordKeptDates = new Set<string>();
    let earliestWordDate = to;
    if (bp?.start_date) {
      // Legacy carry-over streak (prior to start_date)
      const legacyStreak = bp.streak || 0;
      if (legacyStreak > 0) {
        for (let i = 1; i <= legacyStreak; i++) {
          const d = addDays(bp.start_date, -i);
          wordKeptDates.add(d);
          if (d < earliestWordDate) earliestWordDate = d;
        }
      }
      // Actual completed days (from start_date onwards)
      if (bp.completed_days && bp.completed_days.length > 0) {
        for (const day of bp.completed_days) {
          const d = addDays(bp.start_date, day - 1);
          wordKeptDates.add(d);
          if (d < earliestWordDate) earliestWordDate = d;
        }
      }
    }

    const prayerKeptDates = new Set<string>();
    let earliestPrayerDate = to;
    for (const row of wp) {
      if (row.created_at) {
        const d = toChicagoDate(row.created_at);
        prayerKeptDates.add(d);
        if (d < earliestPrayerDate) earliestPrayerDate = d;
      }
    }
    for (const row of pr) {
      if (row.asked_on) {
        const d = row.asked_on;
        prayerKeptDates.add(d);
        if (d < earliestPrayerDate) earliestPrayerDate = d;
      }
      if (row.created_at) {
        const d = toChicagoDate(row.created_at);
        prayerKeptDates.add(d);
        if (d < earliestPrayerDate) earliestPrayerDate = d;
      }
    }

    const fastKeptDates = new Set<string>();
    let earliestFastDate = to;
    const validFastIds = new Set(fs.map(f => f.id));
    for (const row of re) {
      if (row.entry_date && row.fast_id && !row.burned && validFastIds.has(row.fast_id)) {
        const d = row.entry_date;
        fastKeptDates.add(d);
        if (d < earliestFastDate) earliestFastDate = d;
      }
    }

    const recordKeptDates = new Set<string>();
    let earliestRecordDate = to;
    for (const row of re) {
      if (row.entry_date && !row.burned) {
        const d = row.entry_date;
        recordKeptDates.add(d);
        if (d < earliestRecordDate) earliestRecordDate = d;
      }
    }

    const rhythmKeptDates = new Set<string>();
    let earliestRhythmDate = to;
    const addAllToRhythm = (datesSet: Set<string>) => {
      for (const d of datesSet) {
        rhythmKeptDates.add(d);
        if (d < earliestRhythmDate) earliestRhythmDate = d;
      }
    };
    addAllToRhythm(wordKeptDates);
    addAllToRhythm(prayerKeptDates);
    addAllToRhythm(fastKeptDates);
    addAllToRhythm(recordKeptDates);

    // Calculate chains
    const chains = {
      word: wordKeptDates.size > 0 ? calculateChain(wordKeptDates, earliestWordDate, to) : { current: 0, longest: 0, graced_days: [] },
      prayer: prayerKeptDates.size > 0 ? calculateChain(prayerKeptDates, earliestPrayerDate, to) : { current: 0, longest: 0, graced_days: [] },
      fast: fastKeptDates.size > 0 ? calculateChain(fastKeptDates, earliestFastDate, to) : { current: 0, longest: 0, graced_days: [] },
      record: recordKeptDates.size > 0 ? calculateChain(recordKeptDates, earliestRecordDate, to) : { current: 0, longest: 0, graced_days: [] },
      rhythm: rhythmKeptDates.size > 0 ? calculateChain(rhythmKeptDates, earliestRhythmDate, to) : { current: 0, longest: 0, graced_days: [] },
    };

    // Fast active ranges lookup for daily ledger range
    const fastRanges = fs
      .filter(f => f.status !== 'revealed')
      .map(f => {
        const startMs = new Date(f.start_date + "T00:00:00Z").getTime();
        const durationDays = (f.status === 'ended_early' && f.ended_day) ? f.ended_day : f.duration;
        const endMs = startMs + (durationDays - 1) * 24 * 60 * 60 * 1000;
        return { id: f.id, startMs, endMs };
      });

    const fastReports = new Set<string>();
    for (const row of re) {
      if (row.entry_date && row.fast_id && !row.burned) {
        fastReports.add(`${row.entry_date}|${row.fast_id}`);
      }
    }

    // Generate dates in queried range
    const dates: string[] = [];
    let current = new Date(from + "T00:00:00Z");
    const endDate = new Date(to + "T00:00:00Z");
    while (current <= endDate) {
      dates.push(current.toISOString().split('T')[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    const days = dates.map(D => {
      const dMs = new Date(D + "T00:00:00Z").getTime();

      // word
      let wordVal = false;
      if (bp?.start_date) {
        const dayIndex = getDayIndex(bp.start_date, D);
        if (bp.completed_days && bp.completed_days.includes(dayIndex)) {
          wordVal = true;
        }
      }

      // prayer
      const prayerVal = prayerKeptDates.has(D);

      // fast
      const activeFastForDay = fastRanges.find(fr => dMs >= fr.startMs && dMs <= fr.endMs);
      let fastVal: boolean | null = null;
      if (activeFastForDay) {
        fastVal = fastReports.has(`${D}|${activeFastForDay.id}`);
      }

      // record
      const recordVal = recordKeptDates.has(D);

      return {
        date: D,
        word: wordVal,
        prayer: prayerVal,
        fast: fastVal,
        record: recordVal
      };
    });

    // Compute last_active up to "to"
    let lastActiveWord: string | null = null;
    if (bp?.start_date && bp.completed_days?.length > 0) {
      const validDates = bp.completed_days
        .map(day => addDays(bp.start_date, day - 1))
        .filter(d => d <= to);
      if (validDates.length > 0) {
        lastActiveWord = validDates.reduce((max, d) => d > max ? d : max, validDates[0]);
      }
    }

    let lastActivePrayer: string | null = null;
    const validPrayerDates = Array.from(prayerKeptDates).filter(d => d <= to);
    if (validPrayerDates.length > 0) {
      lastActivePrayer = validPrayerDates.reduce((max, d) => d > max ? d : max, validPrayerDates[0]);
    }

    let lastActiveFast: string | null = null;
    const validFastDates = re
      .filter(row => row.entry_date && row.entry_date <= to && row.fast_id && validFastIds.has(row.fast_id) && !row.burned)
      .map(row => row.entry_date);
    if (validFastDates.length > 0) {
      lastActiveFast = validFastDates.reduce((max, d) => d > max ? d : max, validFastDates[0]);
    }

    let lastActiveRecord: string | null = null;
    const validRecordDates = Array.from(recordKeptDates).filter(d => d <= to);
    if (validRecordDates.length > 0) {
      lastActiveRecord = validRecordDates.reduce((max, d) => d > max ? d : max, validRecordDates[0]);
    }

    const todayVal = days.find(d => d.date === to) || {
      date: to,
      word: false,
      prayer: false,
      fast: null,
      record: false
    };

    return new Response(JSON.stringify({
      days,
      today: todayVal,
      last_active: {
        word: lastActiveWord,
        prayer: lastActivePrayer,
        fast: lastActiveFast,
        record: lastActiveRecord
      },
      chains
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
