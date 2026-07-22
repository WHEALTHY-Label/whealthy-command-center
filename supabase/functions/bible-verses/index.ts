// bible-verses: owned scripture library (Berean Standard Bible, public domain).
// Drop-in replacement for bible-api.com. Same response shape:
//   { reference, verses:[{book_name, chapter, verse, text}], text, translation_id, translation_name }
// Supports what bible-api.com cannot: multi-chapter ranges ("Genesis 1-2") and cross-chapter
// verse ranges ("John 3:16-4:2").
// House rules: page sends no keys; this function holds the service role; scripture is never generated.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Book name aliases -> canonical names as stored in bible_verses.book
const ALIAS: Record<string, string> = {
  'psalm': 'Psalms', 'psalms': 'Psalms',
  'song of songs': 'Song of Solomon', 'songs of solomon': 'Song of Solomon',
  'revelation of john': 'Revelation', 'revelations': 'Revelation',
  'ecclesiast': 'Ecclesiastes',
};

function normBook(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  // Roman numeral prefixes to arabic: "II Kings" -> "2 Kings"
  s = s.replace(/^iii\s+/i, '3 ').replace(/^ii\s+/i, '2 ').replace(/^i\s+/i, '1 ');
  const key = s.toLowerCase();
  if (ALIAS[key]) return ALIAS[key];
  // Title-case each word for exact match against stored names
  return s.split(' ').map(w => /^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

interface ParsedRef {
  book: string; c1: number | null; v1: number | null; c2: number | null; v2: number | null;
}

// Accepts: "John" | "John 3" | "John 3:16" | "John 3:16-18" | "Genesis 1-2" | "John 3:16-4:2"
function parseRef(input: string): ParsedRef | null {
  const s = decodeURIComponent(input).replace(/\+/g, ' ').trim();
  const m = s.match(/^((?:[123]|I{1,3})?\s*[A-Za-z][A-Za-z ]*?)\s*(?:(\d+)\s*(?::\s*(\d+))?\s*(?:-\s*(\d+)\s*(?::\s*(\d+))?)?)?$/);
  if (!m) return null;
  const book = normBook(m[1]);
  const a = m[2] ? parseInt(m[2]) : null;   // first chapter
  const b = m[3] ? parseInt(m[3]) : null;   // first verse (after colon)
  const c = m[4] ? parseInt(m[4]) : null;   // number after dash
  const d = m[5] ? parseInt(m[5]) : null;   // verse after dash-colon
  if (a === null) return { book, c1: null, v1: null, c2: null, v2: null };
  if (b === null) {
    // "John 3" or "Genesis 1-2"
    return { book, c1: a, v1: null, c2: c ?? a, v2: null };
  }
  if (c === null) {
    // "John 3:16"
    return { book, c1: a, v1: b, c2: a, v2: b };
  }
  if (d === null) {
    // "John 3:16-18" (same chapter verse range)
    return { book, c1: a, v1: b, c2: a, v2: c };
  }
  // "John 3:16-4:2" (cross-chapter)
  return { book, c1: a, v1: b, c2: c, v2: d };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    let ref = '';
    const url = new URL(req.url);
    ref = url.searchParams.get('ref') ?? '';
    if (!ref) {
      // path style: /bible-verses/John%203:16
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('bible-verses');
      if (idx >= 0 && parts.length > idx + 1) ref = parts.slice(idx + 1).join('/');
    }
    if (!ref && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      ref = body.ref ?? '';
    }
    if (!ref) {
      return json({ error: 'Missing reference. Use ?ref=John 3:16' }, 400);
    }

    const p = parseRef(ref);
    if (!p) return json({ error: 'Could not parse reference: ' + ref }, 400);

    // Bare book: single-chapter books get their whole text, multi-chapter books get chapter 1.
    let c1 = p.c1, c2 = p.c2;
    if (c1 === null) { c1 = 1; c2 = 1; }

    const { data, error } = await supabase
      .from('bible_verses')
      .select('book, chapter, verse, text')
      .eq('book', p.book)
      .gte('chapter', c1)
      .lte('chapter', c2 ?? c1)
      .order('chapter', { ascending: true })
      .order('verse', { ascending: true });

    if (error) return json({ error: 'Lookup failed' }, 500);
    let rows = (data ?? []) as Array<{ book: string; chapter: number; verse: number; text: string }>;

    // Trim verse bounds on the edge chapters
    if (p.v1 !== null) rows = rows.filter(r => !(r.chapter === c1) || r.verse >= (p.v1 as number));
    if (p.v2 !== null) rows = rows.filter(r => !(r.chapter === (c2 ?? c1)) || r.verse <= (p.v2 as number));

    if (!rows.length) return json({ error: 'Reference not found: ' + ref }, 404);

    const first = rows[0], last = rows[rows.length - 1];
    let reference = p.book + ' ' + first.chapter;
    if (p.v1 !== null || rows.length < 500) {
      if (first.chapter === last.chapter) {
        reference = p.book + ' ' + first.chapter + (p.v1 !== null ? ':' + first.verse + (last.verse !== first.verse ? '-' + last.verse : '') : '');
      } else {
        reference = p.book + ' ' + first.chapter + (p.v1 !== null ? ':' + first.verse : '') + '-' + last.chapter + (p.v2 !== null ? ':' + last.verse : '');
      }
    }

    return json({
      reference,
      verses: rows.map(r => ({ book_name: r.book, chapter: r.chapter, verse: r.verse, text: r.text })),
      text: rows.map(r => r.text).join(' '),
      translation_id: 'BSB',
      translation_name: 'Berean Standard Bible',
      translation_note: 'Public domain',
    });
  } catch (_e) {
    return json({ error: 'Unexpected error' }, 500);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
