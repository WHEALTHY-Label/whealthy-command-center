/**
 * Admin data parsing against the DEPLOYED responses, including the two
 * places the legacy client read keys that do not exist:
 *  - admin-rhythm-stats answers {plans, assessments, adherence, slots,
 *    products}; the old client read flat keys and rendered zeros forever.
 *  - wall-moderate answers no `ok` field on GET and `success` on POST.
 */

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}

export interface RhythmStats {
  activePlans: number;
  draftPlans: number;
  membersWithPlan: number;
  currentAssessments: number;
  chronotypes: [string, number][];
  avgAdherence30: number;
  membersMeasured: number;
  activeSlots: number;
  byDomain: [string, number][];
}

export function parseRhythmStats(data: unknown): RhythmStats {
  const d = rec(data);
  const plans = rec(d.plans);
  const assessments = rec(d.assessments);
  const adherence = rec(d.adherence);
  const slots = rec(d.slots);
  const pairs = (v: unknown): [string, number][] =>
    Array.isArray(v)
      ? v
          .filter((p): p is unknown[] => Array.isArray(p) && p.length >= 2)
          .map((p) => [String(p[0]), num(p[1])] as [string, number])
      : [];
  return {
    activePlans: num(plans.active),
    draftPlans: num(plans.draft),
    membersWithPlan: num(plans.members_with_plan),
    currentAssessments: num(assessments.current),
    chronotypes: pairs(assessments.chronotype),
    avgAdherence30: num(adherence.avg30),
    membersMeasured: num(adherence.members_measured),
    activeSlots: num(slots.total_active),
    byDomain: pairs(slots.by_domain),
  };
}

export interface StatKpis {
  free: number;
  unverified: number;
  paid: number;
  purchasers: number;
  conv: number;
  mrr: number;
  churned: number;
  dau: number;
  wau: number;
  mau: number;
  opens: number;
  fastsStarted: number;
  fastsActive: number;
  fastsCompleted: number;
  prayerHanded: number;
  prayerLifted: number;
  prayerAnswered: number;
  testimonies: number;
  reportsOpen: number;
  b365Users: number;
  myBibleReaders: number;
  wordDeliveries: number;
  skoolMembers: number;
  skoolPosts: number;
  circles: number;
  cohorts: number;
  tourDone: number;
  recordEntries: number;
}

/** The overview subset of admin-stats the Control Panel renders. */
export function parseAdminStats(data: unknown): StatKpis {
  const d = rec(data);
  const members = rec(d.members);
  const health = rec(d.memberHealth);
  const activity = rec(d.activity);
  const fasts = rec(d.fasts);
  const prayer = rec(d.prayer);
  const scripture = rec(d.scripture);
  const community = rec(d.community);
  const groups = rec(d.groups);
  const onboarding = rec(d.onboarding);
  const record = rec(d.record);
  return {
    free: num(members.free),
    unverified: num(members.unverified),
    paid: num(members.paid),
    purchasers: num(members.purchasers),
    conv: num(members.conv),
    mrr: num(health.mrr),
    churned: num(health.churned),
    dau: num(activity.dau),
    wau: num(activity.wau),
    mau: num(activity.mau),
    opens: num(activity.opens),
    fastsStarted: num(fasts.started),
    fastsActive: num(fasts.active),
    fastsCompleted: num(fasts.completed),
    prayerHanded: num(prayer.handed),
    prayerLifted: num(prayer.lifted),
    prayerAnswered: num(prayer.answered),
    testimonies: num(prayer.testimonies),
    reportsOpen: num(prayer.reportsOpen),
    b365Users: num(scripture.b365Users),
    myBibleReaders: num(scripture.myBibleReaders),
    wordDeliveries: num(scripture.wordDeliveries),
    skoolMembers: num(community.skoolMembers),
    skoolPosts: num(community.skoolPosts),
    circles: num(groups.circles),
    cohorts: num(groups.cohorts),
    tourDone: num(onboarding.tourDone),
    recordEntries: num(record.entries),
  };
}

export interface Registration {
  id: string;
  email: string;
  name: string | null;
  skoolHandle: string | null;
  note: string | null;
  status: string;
  createdAt: string | null;
}

export function parseRegistrations(data: unknown): { rows: Registration[]; pending: number } {
  const d = rec(data);
  const rows = Array.isArray(d.registrations)
    ? d.registrations
        .map(rec)
        .filter((r) => r.id !== undefined)
        .map((r) => ({
          id: String(r.id),
          email: str(r.email) ?? '',
          name: str(r.name),
          skoolHandle: str(r.skool_handle),
          note: str(r.note),
          status: str(r.status) ?? 'pending',
          createdAt: str(r.created_at),
        }))
    : [];
  return { rows, pending: num(d.pending_count) };
}

export interface RosterMember {
  id: number;
  email: string;
  name: string;
  memberStatus: string;
  active: boolean;
  adminRole: string | null;
  skoolHandle: string | null;
  joinedAt: string | null;
}

export function parseRoster(data: unknown): RosterMember[] {
  const d = rec(data);
  if (!Array.isArray(d.members)) return [];
  return d.members
    .map(rec)
    .filter((m) => m.email !== undefined)
    .map((m) => ({
      id: num(m.id),
      email: str(m.email) ?? '',
      name: [str(m.name), str(m.last_name)].filter(Boolean).join(' ') || 'Steward',
      memberStatus: str(m.member_status) ?? '',
      active: m.active === true,
      adminRole: str(m.admin_role),
      skoolHandle: str(m.skool_handle),
      joinedAt: str(m.joined_at),
    }));
}

export interface Setting {
  key: string;
  value: string;
  updatedAt: string | null;
}

export function parseSettings(data: unknown): Setting[] {
  const d = rec(data);
  if (!Array.isArray(d.settings)) return [];
  return d.settings
    .map(rec)
    .filter((s) => typeof s.key === 'string')
    .map((s) => ({
      key: s.key as string,
      value: str(s.value) ?? '',
      updatedAt: str(s.updated_at),
    }));
}

export interface AuditRow {
  actorEmail: string;
  actorRole: string;
  action: string;
  target: string;
  createdAt: string | null;
}

export function parseAudit(data: unknown): AuditRow[] {
  const d = rec(data);
  if (!Array.isArray(d.log)) return [];
  return d.log.map(rec).map((l) => ({
    actorEmail: str(l.actor_email) ?? '',
    actorRole: str(l.actor_role) ?? '',
    action: str(l.action) ?? '',
    target: str(l.target) ?? '',
    createdAt: str(l.created_at),
  }));
}

export interface ModerationItem {
  postId: string;
  body: string;
  reportCount: number;
  source: string;
  createdAt: string | null;
}

/** GET wall-moderate answers {queue, caller_role} with NO ok field. */
export function parseModerationQueue(data: unknown): ModerationItem[] {
  const d = rec(data);
  if (!Array.isArray(d.queue)) return [];
  return d.queue
    .map(rec)
    .filter((q) => q.post_id !== undefined)
    .map((q) => ({
      postId: String(q.post_id),
      body: str(q.body) ?? '',
      reportCount: num(q.report_count),
      source: str(q.source) ?? '',
      createdAt: str(q.created_at),
    }));
}
