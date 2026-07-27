'use client';

import { applyAiHeader, type AiHeaderView } from '@/lib/pageHeader';
import { useRequestedPersonalization } from './PersonalizationProvider';
import ui from '@/components/ui.module.css';

/**
 * A personalized header on one of the two surfaces the `synthesis` answer
 * carries copy for.
 *
 * The server has already rendered the deterministic header, so this never
 * flashes empty and never waits: if the model is slow, refused, or the steward
 * is offline, what arrived with the page simply stays. When the answer does
 * land it replaces the title and the subtitle independently, which is what
 * legacy's `aiMap` did once its per-field `|| personalMap...` fallbacks are
 * read (index.html:18540-18541).
 */
export function PersonalHeaderText({
  view,
  eyebrow,
  title,
  sub,
}: {
  view: AiHeaderView;
  eyebrow: string;
  title: string;
  sub: string;
}) {
  const { ai } = useRequestedPersonalization();
  const header = applyAiHeader(
    { title, sub },
    (view === 'record' ? ai?.recordTitle : ai?.fastTitle) ?? null,
    (view === 'record' ? ai?.recordSubtitle : ai?.fastSubtitle) ?? null,
  );

  return (
    <header className={ui.header}>
      <p className={ui.eyebrow}>{eyebrow}</p>
      <h1 className={ui.title}>{header.title}</h1>
      <p className={ui.sub}>{header.sub}</p>
    </header>
  );
}
