/**
 * Per-view header copy, ported from `personalizePageHeader` at
 * index.html:18491-18558.
 *
 * The live app rewrote each view's `<h1>` and subtitle the moment the view
 * opened: not "Product Portal" but "Ignacio's Product Portal". The copy is a
 * deterministic map of the steward's first name plus, on the claim view, his
 * archetype, so the header is never empty and never waits on a model. The AI
 * layer from `governor-ai` is laid over the top field by field, which is what
 * the legacy `aiMap` did once its own `|| personalMap...` fallbacks are read
 * carefully: every non-dash entry already fell back per field, so the
 * both-fields-present guard could never fail there.
 *
 * Two legacy views are deliberately absent.
 *
 * `bible` is in the legacy `personalMap` and the model still returns
 * `bibleTitle`/`bibleSubtitle`, but index.html has no `bibleTitle` or
 * `bibleSubtitle` element, so that branch never drew anything on the live app.
 * Reproducing dead code is not parity, and the Word surface keeps its own
 * header here.
 *
 * `dash` is handled by `DirectiveCard`, because the dashboard heading is a
 * greeting built from the browser's local hour rather than from this map.
 *
 * Everything in this file is pure so it can be tested. The name and archetype
 * are resolved by the caller.
 */

/** The views whose header the live app personalized and actually rendered. */
export const PERSONAL_VIEWS = [
  'claim',
  'record',
  'fast',
  'portal',
  'affiliate',
  'community',
] as const;

export type PersonalView = (typeof PERSONAL_VIEWS)[number];

/**
 * The views the `synthesis` prompt returns header copy for. `dash` is the
 * fourth and lives on the dashboard; `bible` is the fifth and never drew.
 */
export const AI_HEADER_VIEWS = ['record', 'fast'] as const;

export type AiHeaderView = (typeof AI_HEADER_VIEWS)[number];

export function isAiHeaderView(view: PersonalView): view is AiHeaderView {
  return view === 'record' || view === 'fast';
}

export interface PageHeader {
  title: string;
  sub: string;
}

/** The local part of an email address, or null when there is not one. */
function localPart(email: string | null): string | null {
  if (typeof email !== 'string') return null;
  const local = email.split('@')[0]?.trim() ?? '';
  return local.length > 0 ? local : null;
}

/**
 * The steward's first name, capitalized.
 *
 * Legacy: `(MEMBER_NAME || MEMBER_EMAIL.split('@')[0] || 'Steward')
 * .split(' ')[0]`, then the first character upper-cased. The email fallback
 * matters more than it looks: a member who bought through a link that never
 * asked for a name still gets addressed by something recognisable rather than
 * by the word "Steward".
 */
export function stewardFirstName(name: string | null, email: string | null): string {
  const raw =
    (typeof name === 'string' && name.trim().length > 0 ? name.trim() : null) ??
    localPart(email) ??
    'Steward';
  const first = raw.split(/\s+/)[0] ?? 'Steward';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * An archetype key or name, readable. Legacy replaced `[_-]` with spaces and
 * title-cased every word. Returns '' for nothing, because the claim subtitle
 * drops the whole archetype clause rather than naming a blank one.
 */
export function archetypeLabel(raw: string | null): string {
  if (typeof raw !== 'string') return '';
  const s = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length === 0) return '';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The deterministic header for one view. Copy is index.html:18500-18533
 * verbatim; only the claim subtitle varies, on whether the archetype is known.
 */
export function pageHeader(view: PersonalView, firstName: string, archetype: string): PageHeader {
  const name = firstName.length > 0 ? firstName : 'Steward';
  const arch = archetype.trim();
  switch (view) {
    case 'claim':
      return {
        title: `${name}'s Governance Bundle`,
        sub: arch
          ? `Your personal blend is ready. Matched to archetype: ${arch}.`
          : 'Your personal blend is ready.',
      };
    case 'record':
      return {
        title: `${name}'s Daily Scribe`,
        sub: 'Write your thoughts, log your rules, and keep the standard.',
      };
    case 'fast':
      return {
        title: `${name}'s Fast Protocol`,
        sub: 'Track your fasting days, daily directives, and physical sync status.',
      };
    case 'portal':
      return {
        title: `${name}'s Product Portal`,
        sub: 'Manage subscriptions, update payment methods, and edit delivery cycles.',
      };
    case 'affiliate':
      return {
        title: `${name}'s Affiliate Command`,
        sub: 'Spread your stewardship. Share invite links and unlock free months.',
      };
    case 'community':
      return {
        title: `${name}'s Steward Circle`,
        sub: 'Discuss routines, share insights, and connect with fellow creators.',
      };
  }
}

/**
 * Lay the model's copy over the deterministic header, field by field.
 *
 * Legacy read `window.aiPersonalizations.recordTitle || personalMap.record.title`
 * for each field independently, so a model that returned a title but no
 * subtitle kept the deterministic subtitle rather than losing the header. The
 * dashboard is the one place that demands both, and it does not come through
 * here.
 */
export function applyAiHeader(
  base: PageHeader,
  title: string | null,
  sub: string | null,
): PageHeader {
  return {
    title: typeof title === 'string' && title.trim().length > 0 ? title.trim() : base.title,
    sub: typeof sub === 'string' && sub.trim().length > 0 ? sub.trim() : base.sub,
  };
}
