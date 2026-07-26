'use client';

import { useState, useTransition } from 'react';
import type {
  AuditRow,
  ModerationItem,
  Registration,
  RosterMember,
  Setting,
} from '@/lib/adminview';
import {
  actOnRegistration,
  banMember,
  createCohort,
  deleteSetting,
  loadAudit,
  loadModerationQueue,
  loadRegistrations,
  loadSettings,
  moderatePost,
  saveSetting,
  setMemberActive,
  setMemberRole,
  setMemberStatus,
} from './actions';
import ui from '@/components/ui.module.css';
import styles from './admin.module.css';

type Tab = 'registrations' | 'members' | 'moderation' | 'settings' | 'audit' | 'cohort';

const TABS: { key: Tab; label: string }[] = [
  { key: 'registrations', label: 'Registrations' },
  { key: 'members', label: 'Members' },
  { key: 'moderation', label: 'Moderation' },
  { key: 'settings', label: 'Settings' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'cohort', label: 'Challenge' },
];

export function AdminClient({
  initialRegistrations,
  initialPending,
  initialRoster,
}: {
  initialRegistrations: Registration[];
  initialPending: number;
  initialRoster: RosterMember[];
}) {
  const [tab, setTab] = useState<Tab>('registrations');
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [pendingCount, setPendingCount] = useState(initialPending);
  const [roster, setRoster] = useState(initialRoster);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [queue, setQueue] = useState<ModerationItem[] | null>(null);
  const [settingKey, setSettingKey] = useState('');
  const [settingVal, setSettingVal] = useState('');
  const [cohortName, setCohortName] = useState('');
  const [cohortStart, setCohortStart] = useState('');
  const [cohortEnd, setCohortEnd] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openTab = (next: Tab) => {
    setTab(next);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      if (next === 'settings' && settings === null) setSettings(await loadSettings());
      if (next === 'audit' && audit === null) setAudit(await loadAudit());
      if (next === 'moderation' && queue === null) setQueue(await loadModerationQueue());
    });
  };

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'That did not save.');
        return;
      }
      after?.();
    });
  };

  const refreshRegistrations = async () => {
    const { rows, pending: count } = await loadRegistrations();
    setRegistrations(rows);
    setPendingCount(count);
  };

  const filteredRoster = roster.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.skoolHandle ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className={styles.tabBar} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? styles.tabActive : styles.tab}
            onClick={() => openTab(t.key)}
          >
            {t.label}
            {t.key === 'registrations' && pendingCount > 0 ? (
              <span className={styles.badge}>{pendingCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? <p className={ui.error}>{error}</p> : null}
      {message ? <p className={ui.good}>{message}</p> : null}

      {tab === 'registrations' ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Pending registrations</p>
          {registrations.length === 0 ? (
            <p className={ui.sub}>Nothing waiting.</p>
          ) : (
            registrations.map((r) => (
              <div key={r.id} className={ui.listRow}>
                <div className={styles.cellBody}>
                  <span className={styles.cellName}>{r.name ?? r.email}</span>
                  <span className={ui.sub}>
                    {r.email}
                    {r.skoolHandle ? ` · @${r.skoolHandle}` : ''}
                  </span>
                  {r.note ? <span className={ui.sub}>{r.note}</span> : null}
                </div>
                <div className={ui.row}>
                  <button
                    type="button"
                    className={ui.primary}
                    disabled={pending}
                    onClick={() =>
                      act(
                        () => actOnRegistration(r.id, 'approve'),
                        () => void refreshRegistrations(),
                      )
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={ui.danger}
                    disabled={pending}
                    onClick={() =>
                      act(
                        () => actOnRegistration(r.id, 'reject'),
                        () => void refreshRegistrations(),
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === 'members' ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Steward roster ({roster.length})</p>
          <input
            className={ui.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or Skool handle..."
          />
          {filteredRoster.slice(0, 100).map((m) => (
            <div key={m.email} className={ui.listRow}>
              <div className={styles.cellBody}>
                <span className={styles.cellName}>{m.name}</span>
                <span className={ui.sub}>
                  {m.email}
                  {m.skoolHandle ? ` · @${m.skoolHandle}` : ''}
                </span>
                <div className={ui.row}>
                  {m.adminRole ? <span className={ui.pillLime}>{m.adminRole}</span> : null}
                  <span className={m.memberStatus === 'banned' ? ui.pillAmber : ui.pill}>
                    {m.memberStatus || 'lead'}
                  </span>
                  <span className={m.active ? ui.pillGreen : ui.pill}>
                    {m.active ? 'active' : 'inactive'}
                  </span>
                </div>
              </div>
              {m.adminRole === 'master' ? (
                <span className={ui.sub}>Protected</span>
              ) : (
                <div className={ui.row}>
                  <select
                    className={`${ui.select} ${styles.rowSelect}`}
                    value={m.adminRole ?? ''}
                    aria-label={`Role for ${m.email}`}
                    onChange={(e) => {
                      const value = e.target.value;
                      const role = value === 'admin' || value === 'moderator' ? value : null;
                      act(
                        () => setMemberRole(m.email, role),
                        () =>
                          setRoster((r) =>
                            r.map((x) => (x.email === m.email ? { ...x, adminRole: role } : x)),
                          ),
                      );
                    }}
                  >
                    <option value="">Steward</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select
                    className={`${ui.select} ${styles.rowSelect}`}
                    value={m.memberStatus === 'member' ? 'member' : 'lead'}
                    aria-label={`Status for ${m.email}`}
                    onChange={(e) => {
                      const status = e.target.value === 'member' ? 'member' : 'lead';
                      act(
                        () => setMemberStatus(m.email, status),
                        () =>
                          setRoster((r) =>
                            r.map((x) => (x.email === m.email ? { ...x, memberStatus: status } : x)),
                          ),
                      );
                    }}
                  >
                    <option value="member">Member</option>
                    <option value="lead">Lead</option>
                  </select>
                  <button
                    type="button"
                    className={ui.quiet}
                    disabled={pending}
                    onClick={() =>
                      act(
                        () => setMemberActive(m.email, !m.active),
                        () =>
                          setRoster((r) =>
                            r.map((x) => (x.email === m.email ? { ...x, active: !m.active } : x)),
                          ),
                      )
                    }
                  >
                    {m.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className={ui.danger}
                    disabled={pending}
                    onClick={() => {
                      const banning = m.memberStatus !== 'banned';
                      act(
                        () => banMember(m.email, banning),
                        () =>
                          setRoster((r) =>
                            r.map((x) =>
                              x.email === m.email
                                ? { ...x, memberStatus: banning ? 'banned' : 'member', active: !banning }
                                : x,
                            ),
                          ),
                      );
                    }}
                  >
                    {m.memberStatus === 'banned' ? 'Unban' : 'Ban'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredRoster.length > 100 ? (
            <p className={ui.sub}>Showing the first 100. Narrow the search for the rest.</p>
          ) : null}
        </section>
      ) : null}

      {tab === 'moderation' ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Flagged reports queue</p>
          {queue === null ? (
            <p className={ui.sub}>Loading…</p>
          ) : queue.length === 0 ? (
            <p className={ui.sub}>The queue is clear.</p>
          ) : (
            queue.map((q) => (
              <div key={q.postId} className={ui.listRow}>
                <div className={styles.cellBody}>
                  <span className={ui.sub}>
                    {q.source} · {q.reportCount} report{q.reportCount === 1 ? '' : 's'}
                  </span>
                  <span className={styles.cellName}>{q.body.slice(0, 160)}</span>
                </div>
                <div className={ui.row}>
                  <button
                    type="button"
                    className={ui.danger}
                    disabled={pending}
                    onClick={() =>
                      act(
                        () => moderatePost(q.postId, 'uphold'),
                        () => setQueue((list) => (list ?? []).filter((x) => x.postId !== q.postId)),
                      )
                    }
                  >
                    Uphold
                  </button>
                  <button
                    type="button"
                    className={ui.quiet}
                    disabled={pending}
                    onClick={() =>
                      act(
                        () => moderatePost(q.postId, 'dismiss'),
                        () => setQueue((list) => (list ?? []).filter((x) => x.postId !== q.postId)),
                      )
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section className={ui.card}>
          <p className={ui.kicker}>System configuration flags</p>
          {settings === null ? (
            <p className={ui.sub}>Loading…</p>
          ) : (
            settings.map((s) => (
              <div key={s.key} className={ui.listRow}>
                <div className={styles.cellBody}>
                  <span className={styles.cellName}>{s.key}</span>
                  <span className={ui.sub}>{s.value}</span>
                </div>
                <button
                  type="button"
                  className={ui.danger}
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => deleteSetting(s.key),
                      () => setSettings((list) => (list ?? []).filter((x) => x.key !== s.key)),
                    )
                  }
                >
                  Delete
                </button>
              </div>
            ))
          )}
          <div className={ui.row}>
            <input
              className={ui.input}
              value={settingKey}
              onChange={(e) => setSettingKey(e.target.value)}
              placeholder="e.g. AUTO_INVITE_ENABLED"
            />
            <input
              className={ui.input}
              value={settingVal}
              onChange={(e) => setSettingVal(e.target.value)}
              placeholder="e.g. true or value string"
            />
            <button
              type="button"
              className={ui.primary}
              disabled={pending || !settingKey.trim()}
              onClick={() =>
                act(
                  () => saveSetting(settingKey.trim(), settingVal),
                  () => {
                    startTransition(async () => setSettings(await loadSettings()));
                    setMessage('Setting saved.');
                  },
                )
              }
            >
              Save key
            </button>
          </div>
        </section>
      ) : null}

      {tab === 'audit' ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Security audit log (last 200 actions)</p>
          {audit === null ? (
            <p className={ui.sub}>Loading…</p>
          ) : audit.length === 0 ? (
            <p className={ui.sub}>No admin actions recorded yet.</p>
          ) : (
            audit.map((a, i) => (
              <div key={i} className={ui.listRow}>
                <div className={styles.cellBody}>
                  <span className={styles.cellName}>{a.action}</span>
                  <span className={ui.sub}>
                    {a.actorEmail} ({a.actorRole}) → {a.target}
                  </span>
                </div>
                <span className={ui.sub}>
                  {a.createdAt ? new Date(a.createdAt).toLocaleString('en-US') : ''}
                </span>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === 'cohort' ? (
        <section className={ui.card}>
          <p className={ui.kicker}>Create new cohort</p>
          <p className={ui.body}>
            Create a new open challenge cohort. Members will be able to join via the Cohort ID.
          </p>
          <input
            className={ui.input}
            value={cohortName}
            onChange={(e) => setCohortName(e.target.value)}
            placeholder="e.g., Summer Fast 2026"
          />
          <div className={ui.row}>
            <input
              type="date"
              className={ui.input}
              value={cohortStart}
              onChange={(e) => setCohortStart(e.target.value)}
              aria-label="Start date"
            />
            <input
              type="date"
              className={ui.input}
              value={cohortEnd}
              onChange={(e) => setCohortEnd(e.target.value)}
              aria-label="End date"
            />
          </div>
          <button
            type="button"
            className={ui.primary}
            disabled={pending || !cohortName.trim() || !cohortStart || !cohortEnd}
            onClick={() =>
              act(
                () => createCohort(cohortName, cohortStart, cohortEnd),
                () => {
                  setMessage('Cohort created and open for joining.');
                  setCohortName('');
                },
              )
            }
          >
            Create cohort
          </button>
        </section>
      ) : null}
    </>
  );
}
