'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { BibleMark, Passage } from '@/lib/bible';
import { BIBLE_BOOKS } from '@/lib/data/bibleBooks';
import { fetchPassage } from '@/lib/actions/scripture';
import { addMark, askBibleBuddy, removeMark, saveBibleSpot } from './actions';
import type { Spot } from './BibleClient';
import ui from '@/components/ui.module.css';
import styles from './bible.module.css';

interface BuddyLine {
  who: 'you' | 'buddy';
  text: string;
  verses?: { reference: string; text: string }[];
}

export function MyBiblePanel({
  spot,
  initialMarks,
}: {
  spot: Spot | null;
  initialMarks: BibleMark[];
}) {
  const [book, setBook] = useState(spot?.book && BIBLE_BOOKS.some((b) => b.name === spot.book) ? spot.book : 'Matthew');
  const [chapter, setChapter] = useState(spot?.chapter ?? 1);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [marks, setMarks] = useState(initialMarks);
  const [selected, setSelected] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [showMarks, setShowMarks] = useState(true);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [buddyDraft, setBuddyDraft] = useState('');
  const [buddyLines, setBuddyLines] = useState<BuddyLine[]>([]);
  const [pending, startTransition] = useTransition();
  const loadSeq = useRef(0);

  const bookInfo = BIBLE_BOOKS.find((b) => b.name === book) ?? BIBLE_BOOKS[39]!;

  // Load the chapter whenever the spot changes, and remember the position
  // server-side so the reader resumes here next visit. The chapter-change
  // handlers reset the passage synchronously; this effect only talks to the
  // outside world and applies the async result.
  useEffect(() => {
    const seq = ++loadSeq.current;
    let cancelled = false;
    void fetchPassage(`${book} ${chapter}`).then((p) => {
      if (!cancelled && seq === loadSeq.current) setPassage(p);
    });
    void saveBibleSpot(book, chapter, null, 'my_bible');
    return () => {
      cancelled = true;
    };
  }, [book, chapter]);

  const goTo = (nextBook: string, nextChapter: number, nextSelected: number | null = null) => {
    setBook(nextBook);
    setChapter(nextChapter);
    setPassage(null);
    setSelected(nextSelected);
    setNoteDraft('');
  };

  const marksHere = marks.filter((m) => m.book === book && m.chapter === chapter);
  const highlightAt = (verse: number) =>
    marksHere.find((m) => m.kind === 'highlight' && m.verse === verse);
  const notesAt = (verse: number) => marksHere.filter((m) => m.kind === 'note' && m.verse === verse);

  const toggleHighlight = (verse: number) => {
    const existing = highlightAt(verse);
    startTransition(async () => {
      const result = existing
        ? await removeMark(existing.id)
        : await addMark(book, chapter, verse, 'highlight', null);
      if (result.ok) setMarks(result.marks);
    });
  };

  const saveNote = (verse: number) => {
    const body = noteDraft.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await addMark(book, chapter, verse, 'note', body);
      if (result.ok) {
        setMarks(result.marks);
        setNoteDraft('');
      }
    });
  };

  const askBuddy = () => {
    const q = buddyDraft.trim();
    if (!q) return;
    setBuddyLines((lines) => [...lines, { who: 'you', text: q }]);
    setBuddyDraft('');
    startTransition(async () => {
      const result = await askBibleBuddy(q, book, chapter);
      setBuddyLines((lines) => [
        ...lines,
        {
          who: 'buddy',
          text: result.reply ?? 'The Buddy is quiet right now. Ask again in a moment.',
          verses: result.verses,
        },
      ]);
    });
  };

  return (
    <>
      <section className={ui.card}>
        <div className={ui.row}>
          <select
            className={`${ui.select} ${styles.bookSelect}`}
            value={book}
            onChange={(e) => goTo(e.target.value, 1)}
            aria-label="Book"
          >
            {BIBLE_BOOKS.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className={`${ui.select} ${styles.chapterSelect}`}
            value={chapter}
            onChange={(e) => goTo(book, Number(e.target.value))}
            aria-label="Chapter"
          >
            {Array.from({ length: bookInfo.chapters }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={ui.quiet}
            aria-label="Previous chapter"
            disabled={chapter <= 1}
            onClick={() => goTo(book, Math.max(1, chapter - 1))}
          >
            ←
          </button>
          <button
            type="button"
            className={ui.quiet}
            aria-label="Next chapter"
            disabled={chapter >= bookInfo.chapters}
            onClick={() => goTo(book, Math.min(bookInfo.chapters, chapter + 1))}
          >
            →
          </button>
        </div>

        <h2 className={styles.heroRef}>
          {book} {chapter}
        </h2>

        {passage === null ? (
          <p className={ui.sub}>
            Opening {book} {chapter}…
          </p>
        ) : passage.verses.length === 0 ? (
          <p className={ui.error}>That chapter did not load. Try again.</p>
        ) : (
          <div className={styles.readerTall}>
            {passage.verses.map((v) => {
              const hl = showMarks && highlightAt(v.verse);
              const hasNote = showMarks && notesAt(v.verse).length > 0;
              return (
                <p
                  key={v.verse}
                  className={`${styles.verseRow} ${hl ? styles.verseHighlighted : ''} ${selected === v.verse ? styles.verseSelected : ''}`}
                  onClick={() => {
                    setSelected((s) => (s === v.verse ? null : v.verse));
                    setNoteDraft('');
                  }}
                >
                  <span className={styles.verseNum}>{v.verse}</span> {v.text}
                  {hasNote ? <span className={styles.noteFlag}> 💬</span> : null}
                </p>
              );
            })}
          </div>
        )}

        {selected !== null ? (
          <div className={styles.verseActions}>
            <p className={ui.kicker}>
              {book} {chapter}:{selected}
            </p>
            <div className={ui.row}>
              <button
                type="button"
                className={highlightAt(selected) ? ui.chipActive : ui.chip}
                disabled={pending}
                onClick={() => toggleHighlight(selected)}
              >
                {highlightAt(selected) ? 'Remove highlight' : 'Highlight (lime)'}
              </button>
            </div>
            {notesAt(selected).map((n) => (
              <div key={n.id} className={styles.note}>
                <p className={ui.body}>{n.body}</p>
                <button
                  type="button"
                  className={ui.quiet}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeMark(n.id);
                      if (result.ok) setMarks(result.marks);
                    })
                  }
                >
                  Remove note
                </button>
              </div>
            ))}
            <div className={ui.row}>
              <input
                className={ui.input}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                maxLength={2000}
                placeholder="Add a personal study note..."
              />
              <button
                type="button"
                className={ui.primary}
                disabled={pending || !noteDraft.trim()}
                onClick={() => saveNote(selected)}
              >
                Save note
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className={ui.card}>
        <div className={ui.row}>
          <p className={ui.kicker}>Study ledger</p>
          <button type="button" className={ui.quiet} onClick={() => setShowMarks((v) => !v)}>
            {showMarks ? 'Hide markups' : 'Show markups'}
          </button>
        </div>
        {marks.length === 0 ? (
          <p className={ui.sub}>No marks yet. Tap any verse to highlight or add notes.</p>
        ) : (
          <ul className={styles.marksList}>
            {marks.slice(0, 50).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={styles.markRow}
                  onClick={() => goTo(m.book, m.chapter, m.verse)}
                >
                  <span className={m.kind === 'highlight' ? ui.pillLime : ui.pill}>
                    {m.kind === 'highlight' ? 'Highlight' : 'Note'}
                  </span>
                  <span className={styles.markRef}>
                    {m.book} {m.chapter}:{m.verse}
                  </span>
                  {m.body ? <span className={ui.sub}>{m.body.slice(0, 60)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={ui.card}>
        <div className={ui.row}>
          <p className={ui.kicker}>The Steward&apos;s Bible Buddy</p>
          <button type="button" className={ui.quiet} onClick={() => setBuddyOpen((v) => !v)}>
            {buddyOpen ? 'Close' : 'Open'}
          </button>
        </div>
        {buddyOpen ? (
          <>
            {buddyLines.length === 0 ? (
              <p className={ui.sub}>
                Ask me anything about today&apos;s scripture passage, or highlight a verse to study
                its context together.
              </p>
            ) : (
              <div className={styles.buddyLog}>
                {buddyLines.map((line, i) => (
                  <div key={i} className={line.who === 'you' ? styles.buddyYou : styles.buddyReply}>
                    <p className={ui.body}>{line.text}</p>
                    {line.verses?.map((v) => (
                      <p key={v.reference} className={styles.buddyVerse}>
                        <strong>{v.reference}</strong> {v.text}
                      </p>
                    ))}
                  </div>
                ))}
                {pending ? <p className={ui.sub}>Thinking…</p> : null}
              </div>
            )}
            <div className={ui.row}>
              <input
                className={ui.input}
                value={buddyDraft}
                onChange={(e) => setBuddyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') askBuddy();
                }}
                maxLength={1000}
                placeholder={`Ask about ${book} ${chapter}...`}
              />
              <button
                type="button"
                className={ui.primary}
                disabled={pending || !buddyDraft.trim()}
                onClick={askBuddy}
              >
                Ask
              </button>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
