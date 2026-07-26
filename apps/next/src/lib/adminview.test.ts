import { describe, expect, it } from 'vitest';
import {
  parseAdminStats,
  parseAudit,
  parseModerationQueue,
  parseRegistrations,
  parseRhythmStats,
  parseRoster,
  parseSettings,
} from './adminview';

describe('parseRhythmStats', () => {
  it('reads the DEPLOYED keys, not the flat names the legacy client invented', () => {
    const s = parseRhythmStats({
      live: true,
      plans: { active: 12, draft: 3, members_with_plan: 11 },
      assessments: { current: 14, chronotype: [['morning', 8], ['evening', 6]] },
      adherence: { avg30: 71, median30: 74, members_measured: 10 },
      slots: { total_active: 40, by_domain: [['supplement', 12]] },
      products: { scheduled: [['charge', 5]] },
    });
    expect(s.activePlans).toBe(12);
    expect(s.chronotypes).toEqual([
      ['morning', 8],
      ['evening', 6],
    ]);
    expect(s.avgAdherence30).toBe(71);
    expect(s.activeSlots).toBe(40);
  });
  it('degrades to zeros on junk', () => {
    expect(parseRhythmStats(null).activePlans).toBe(0);
  });
});

describe('parseAdminStats', () => {
  it('reads the nested admin-stats groups', () => {
    const s = parseAdminStats({
      members: { free: 40, unverified: 5, paid: 12, purchasers: 9, conv: 22 },
      memberHealth: { mrr: 648, churned: 2, nurture: {} },
      activity: { dau: 9, wau: 21, mau: 40, opens: 300 },
      fasts: { started: 15, active: 4, completed: 8 },
      prayer: { handed: 50, lifted: 12, answered: 9, testimonies: 7, reportsOpen: 1 },
      scripture: { b365Users: 18, myBibleReaders: 12, wordDeliveries: 33 },
      community: { skoolMembers: 120, skoolPosts: 31 },
      groups: { circles: 4, cohorts: 2 },
      onboarding: { tourDone: 25 },
      record: { entries: 210 },
    });
    expect(s.paid).toBe(12);
    expect(s.mrr).toBe(648);
    expect(s.reportsOpen).toBe(1);
    expect(s.recordEntries).toBe(210);
  });
});

describe('roster, registrations, settings, audit, moderation', () => {
  it('parses roster rows', () => {
    const rows = parseRoster({
      ok: true,
      members: [
        { id: 1, email: 'a@x.com', name: 'A', last_name: 'B', member_status: 'member', active: true, admin_role: null, skool_handle: 'ab', joined_at: 'x' },
      ],
      caller_role: 'master',
    });
    expect(rows[0]!.name).toBe('A B');
    expect(rows[0]!.active).toBe(true);
  });
  it('parses registrations with the pending count', () => {
    const { rows, pending } = parseRegistrations({
      ok: true,
      registrations: [{ id: 5, email: 'n@x.com', name: null, skool_handle: 'nx', note: null, status: 'pending', created_at: 'x' }],
      pending_count: 1,
    });
    expect(rows).toHaveLength(1);
    expect(pending).toBe(1);
  });
  it('parses settings and audit', () => {
    expect(parseSettings({ ok: true, settings: [{ key: 'member_discount_pct', value: '10', updated_at: 'x' }] })[0]!.value).toBe('10');
    expect(parseAudit({ ok: true, log: [{ actor_email: 'i@x.com', actor_role: 'master', action: 'setting_set', target: 'k', created_at: 'x' }] })[0]!.action).toBe('setting_set');
  });
  it('parses the moderation queue, which ships with NO ok field', () => {
    const q = parseModerationQueue({
      queue: [{ post_id: 9, body: 'flagged', author_member_id: 2, source: 'wall', report_count: 3, reasons: [], created_at: 'x' }],
      caller_role: 'master',
    });
    expect(q[0]!.reportCount).toBe(3);
  });
});
