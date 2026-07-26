'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  groupByWindow,
  type RhythmSlot,
  type RhythmStatus,
  type RhythmSuggestion,
} from '@/lib/rhythm';
import {
  canAddSlot,
  DOMAIN_LABELS,
  draftSummary,
  emptySlotForm,
  fullPlanLine,
  ifThenPreview,
  isSlotFormValid,
  moveSlot,
  openSuggestions,
  SLOT_DOMAINS,
  slotToForm,
  toEditableWindow,
  toSlotDomain,
  type SlotForm,
} from '@/lib/rhythmPlan';
import {
  activatePlan,
  addSlot,
  deleteSlot,
  draftRhythm,
  reorderSlots,
  updateSlot,
  type ActionResult,
} from './actions';
import styles from './build.module.css';

export function BuildFlow({ status }: { status: RhythmStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsAssessment, setNeedsAssessment] = useState(false);
  const [activated, setActivated] = useState(false);
  // Optimistic order; the server is re-read on every refresh.
  const [order, setOrder] = useState<RhythmSlot[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const slots = order ?? status.slots;
  const suggestions = openSuggestions(status.suggestions, slots);
  const full = fullPlanLine(slots.length);

  const run = (fn: () => Promise<ActionResult>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        setNeedsAssessment(result.needsAssessment === true);
        setOrder(null);
        return;
      }
      after?.();
      setOrder(null);
      router.refresh();
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    // Bounds are checked here rather than by comparing arrays: `moveSlot`
    // returns a fresh array either way, so a tap at the end of the list would
    // otherwise fire a pointless reorder round trip.
    const target = index + direction;
    if (index < 0 || target < 0 || target >= slots.length) return;
    const next = moveSlot(slots, index, direction);
    setOrder(next);
    run(() => reorderSlots(next.map((s) => s.id)));
  };

  const addFromSuggestion = (s: RhythmSuggestion) =>
    run(() =>
      addSlot({
        title: s.title,
        domain: toSlotDomain(s.domain),
        cue_type: s.cueType,
        cue_value: s.cue ?? '',
        why: s.why,
        product_key: s.productKey,
        time_window: s.window === 'anytime' ? undefined : s.window,
        if_then_text: s.ifThen,
        duration_min: s.durationMin,
        day_mask: s.dayMask,
      }),
    );

  if (activated) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>The Steward&rsquo;s Rhythm</p>
          <h1 className={styles.title}>Your rhythm is live.</h1>
        </header>
        <p className={styles.sub}>
          It starts today, and it carries only what you approved. Check off each anchor as you keep
          it. A missed day is covered by grace, not a broken streak.
        </p>
        <div className={styles.actions}>
          <Link href="/rhythm" className={styles.primary}>
            Go to my rhythm
          </Link>
        </div>
      </div>
    );
  }

  // Nothing drafted yet: the engine only runs when the steward asks it to.
  if (!status.isDraft && !status.active) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>The Steward&rsquo;s Rhythm</p>
          <h1 className={styles.title}>Let&rsquo;s draft it.</h1>
        </header>
        <p className={styles.sub}>
          We will shape a first draft around your season, your clock and the anchors you already
          keep. It starts small, two anchors, and nothing lands on your day until you approve it.
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}
        {needsAssessment ? (
          <Link href="/rhythm/assess" className={styles.primary}>
            Take the assessment
          </Link>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={pending}
            onClick={() => run(draftRhythm)}
          >
            {pending ? 'Drafting' : 'Draft my rhythm'}
          </button>
        )}
      </div>
    );
  }

  const live = status.active && !status.isDraft;
  const groups = groupByWindow(slots);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{live ? 'Your rhythm' : 'Your draft'}</p>
        <h1 className={styles.title}>{live ? 'Adjust your rhythm' : 'Here is your draft.'}</h1>
        <p className={styles.sub}>
          {live
            ? 'Change anything here. It takes effect on your rhythm right away.'
            : (status.invite ??
              'Start small. Add another when this rhythm holds, a habit sticks better one anchor at a time.')}
        </p>
        {!live ? <p className={styles.count}>{draftSummary(slots)}</p> : null}
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {groups.map((group) => (
        <section key={group.window} className={styles.group}>
          <p className={styles.groupTitle}>{group.label}</p>
          <ul className={styles.slots}>
            {group.slots.map((slot) => {
              const index = slots.findIndex((s) => s.id === slot.id);
              return (
                <li key={slot.id} className={styles.slot}>
                  {editing === slot.id ? (
                    <SlotEditor
                      initial={slotToForm(slot)}
                      pending={pending}
                      submitLabel="Save"
                      onCancel={() => setEditing(null)}
                      onSubmit={(form) =>
                        run(
                          () =>
                            updateSlot(slot.id, {
                              title: form.title.trim(),
                              domain: form.domain,
                              cue_type: form.cueType,
                              cue_value: form.cueValue.trim(),
                              why: form.why.trim() || undefined,
                              if_then_text: ifThenPreview(form),
                              time_window:
                                form.cueType === 'time'
                                  ? toEditableWindow(form.cueValue)
                                  : undefined,
                            }),
                          () => setEditing(null),
                        )
                      }
                    />
                  ) : (
                    <>
                      <div className={styles.slotBody}>
                        <div className={styles.slotHead}>
                          <span className={styles.slotTitle}>{slot.title}</span>
                          {slot.cue ? <span className={styles.slotCue}>{slot.cue}</span> : null}
                        </div>
                        {slot.ifThen ? <p className={styles.ifThen}>{slot.ifThen}</p> : null}
                        {slot.why ? <p className={styles.why}>{slot.why}</p> : null}
                      </div>
                      <div className={styles.slotTools}>
                        <button
                          type="button"
                          className={styles.tool}
                          aria-label={`Move ${slot.title} earlier`}
                          disabled={pending || index <= 0}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={styles.tool}
                          aria-label={`Move ${slot.title} later`}
                          disabled={pending || index < 0 || index >= slots.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={styles.tool}
                          disabled={pending}
                          onClick={() => {
                            setAdding(false);
                            setEditing(slot.id);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.toolQuiet}
                          disabled={pending}
                          onClick={() => run(() => deleteSlot(slot.id))}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {slots.length === 0 ? (
        <p className={styles.sub}>
          Your rhythm is empty. Add an anchor below, or take the assessment again to redraft it.
        </p>
      ) : null}

      {suggestions.length > 0 && canAddSlot(slots.length) ? (
        <section className={styles.group}>
          <p className={styles.groupTitle}>You could also add</p>
          <ul className={styles.suggestions}>
            {suggestions.map((s) => (
              <li key={s.key} className={styles.suggestion}>
                <div className={styles.slotBody}>
                  <div className={styles.slotHead}>
                    <span className={styles.slotTitle}>{s.title}</span>
                    {s.cue ? <span className={styles.slotCue}>{s.cue}</span> : null}
                  </div>
                  {s.why ? <p className={styles.why}>{s.why}</p> : null}
                </div>
                <button
                  type="button"
                  className={styles.tool}
                  disabled={pending}
                  onClick={() => addFromSuggestion(s)}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {full ? <p className={styles.full}>{full}</p> : null}

      {canAddSlot(slots.length) ? (
        adding ? (
          <section className={styles.group}>
            <p className={styles.groupTitle}>Add your own</p>
            <SlotEditor
              initial={emptySlotForm()}
              pending={pending}
              submitLabel="Add"
              onCancel={() => setAdding(false)}
              onSubmit={(form) =>
                run(
                  () =>
                    addSlot({
                      title: form.title.trim(),
                      domain: form.domain,
                      cue_type: form.cueType,
                      cue_value: form.cueValue.trim(),
                      why: form.why.trim() || undefined,
                      if_then_text: ifThenPreview(form),
                      time_window:
                        form.cueType === 'time' ? toEditableWindow(form.cueValue) : undefined,
                    }),
                  () => setAdding(false),
                )
              }
            />
          </section>
        ) : (
          <button
            type="button"
            className={styles.quiet}
            disabled={pending}
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            Add an anchor
          </button>
        )
      ) : null}

      {!live ? (
        <div className={styles.approve}>
          <p className={styles.approveLine}>
            Nothing is on your day until you say so. When this looks right, make it yours.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={pending || slots.length === 0 || !status.planId}
              onClick={() =>
                run(() => activatePlan(status.planId), () => setActivated(true))
              }
            >
              {pending ? 'Setting it' : 'Make this my rhythm'}
            </button>
            <Link href="/rhythm" className={styles.quiet}>
              Not yet
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Link href="/rhythm" className={styles.primary}>
            Done
          </Link>
        </div>
      )}
    </div>
  );
}

function SlotEditor({
  initial,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: SlotForm;
  pending: boolean;
  submitLabel: string;
  onSubmit: (form: SlotForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SlotForm>(initial);
  const patch = (next: Partial<SlotForm>) => setForm((f) => ({ ...f, ...next }));
  const preview = ifThenPreview(form);

  return (
    <div className={styles.editor}>
      <label className={styles.field}>
        <span className={styles.label}>What</span>
        <input
          type="text"
          className={styles.input}
          placeholder="Open the Word"
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Kind</span>
        <select
          className={styles.input}
          value={form.domain}
          onChange={(e) => patch({ domain: toSlotDomain(e.target.value) })}
        >
          {SLOT_DOMAINS.map((d) => (
            <option key={d} value={d}>
              {DOMAIN_LABELS[d]}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.cueRow}>
        <button
          type="button"
          className={form.cueType === 'time' ? styles.chipOn : styles.chip}
          aria-pressed={form.cueType === 'time'}
          onClick={() => patch({ cueType: 'time', cueValue: '' })}
        >
          At a time
        </button>
        <button
          type="button"
          className={form.cueType === 'stack' ? styles.chipOn : styles.chip}
          aria-pressed={form.cueType === 'stack'}
          onClick={() => patch({ cueType: 'stack', cueValue: '' })}
        >
          After something
        </button>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>{form.cueType === 'time' ? 'When' : 'After'}</span>
        {form.cueType === 'time' ? (
          <input
            type="time"
            className={styles.input}
            value={form.cueValue}
            onChange={(e) => patch({ cueValue: e.target.value })}
          />
        ) : (
          <input
            type="text"
            className={styles.input}
            placeholder="the morning cup"
            value={form.cueValue}
            onChange={(e) => patch({ cueValue: e.target.value })}
          />
        )}
      </label>

      {preview ? <p className={styles.preview}>{preview}</p> : null}

      <div className={styles.editorActions}>
        <button
          type="button"
          className={styles.primary}
          disabled={pending || !isSlotFormValid(form)}
          onClick={() => onSubmit(form)}
        >
          {submitLabel}
        </button>
        <button type="button" className={styles.quiet} disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
