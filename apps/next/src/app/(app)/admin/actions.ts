'use server';

import { adminFn } from '@/lib/fn';
import {
  parseAudit,
  parseModerationQueue,
  parseRegistrations,
  parseRoster,
  parseSettings,
  type AuditRow,
  type ModerationItem,
  type Registration,
  type RosterMember,
  type Setting,
} from '@/lib/adminview';

const GENERIC = 'That did not save. Please try again.';

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

function failure(status: number, code: string): AdminActionResult {
  if (status === 403) return { ok: false, error: 'Admin access required.' };
  if (status === 401) return { ok: false, error: 'Sign in as an admin first.' };
  return { ok: false, error: code || GENERIC };
}

/**
 * Why a read came back empty, or null when it came back empty honestly.
 *
 * Every loader below used to answer a failed call with `[]`, which the Control
 * Panel renders identically to a healthy empty table: "Nothing waiting.",
 * "No members." An expired admin session, a 403, or an unreachable function
 * all looked like a quiet, well-run system. This turns each of those into a
 * sentence, and the panel shows it above the (still empty) table.
 */
function readFailure(status: number, code: string): string {
  if (status === 403) return 'Admin access required to read this.';
  if (status === 401) return 'Your admin session expired. Sign in again.';
  if (status === 0) return 'Could not reach the server. Check your connection and retry.';
  return code ? `Could not load this: ${code}` : 'Could not load this. Please retry.';
}

/** A read that reports why it is empty. */
export interface Loaded<T> {
  data: T;
  error: string | null;
}

// ---- Registrations ----

export async function loadRegistrations(): Promise<{
  rows: Registration[];
  pending: number;
  error: string | null;
}> {
  const call = await adminFn('admin-registrations', { action: 'list' });
  if (!call.ok) {
    return { rows: [], pending: 0, error: readFailure(call.status, call.code) };
  }
  return { ...parseRegistrations(call.data), error: null };
}

export async function actOnRegistration(
  id: string,
  action: 'approve' | 'reject',
): Promise<AdminActionResult> {
  const call = await adminFn('admin-registrations', { action, id });
  if (!call.ok) {
    if (call.status === 409) return { ok: false, error: 'Already reviewed.' };
    return failure(call.status, call.code);
  }
  return { ok: true };
}

// ---- Members ----

export async function loadRoster(): Promise<Loaded<RosterMember[]>> {
  const call = await adminFn('admin-members', { action: 'list' });
  if (!call.ok) return { data: [], error: readFailure(call.status, call.code) };
  return { data: parseRoster(call.data), error: null };
}

/**
 * The deployed function reads the TARGET from body.email (the caller is the
 * JWT) and the values from admin_role / member_status. The legacy client
 * sent target_email/role/status, so every write landed on the caller with
 * undefined values; these are the field names the function actually reads.
 */
export async function setMemberRole(
  targetEmail: string,
  role: 'admin' | 'moderator' | null,
): Promise<AdminActionResult> {
  const call = await adminFn('admin-members', {
    action: 'set_role',
    email: targetEmail,
    admin_role: role,
  });
  return call.ok ? { ok: true } : failure(call.status, call.code);
}

export async function setMemberStatus(
  targetEmail: string,
  status: 'member' | 'lead',
): Promise<AdminActionResult> {
  const call = await adminFn('admin-members', {
    action: 'set_status',
    email: targetEmail,
    member_status: status,
  });
  return call.ok ? { ok: true } : failure(call.status, call.code);
}

export async function setMemberActive(
  targetEmail: string,
  active: boolean,
): Promise<AdminActionResult> {
  const call = await adminFn('admin-members', {
    action: 'set_active',
    email: targetEmail,
    active,
  });
  return call.ok ? { ok: true } : failure(call.status, call.code);
}

export async function banMember(targetEmail: string, ban: boolean): Promise<AdminActionResult> {
  const call = await adminFn('admin-members', {
    action: ban ? 'ban' : 'unban',
    email: targetEmail,
  });
  return call.ok ? { ok: true } : failure(call.status, call.code);
}

// ---- Settings ----

export async function loadSettings(): Promise<Loaded<Setting[]>> {
  const call = await adminFn('admin-settings', { action: 'list' });
  if (!call.ok) return { data: [], error: readFailure(call.status, call.code) };
  return { data: parseSettings(call.data), error: null };
}

export async function saveSetting(key: string, value: string): Promise<AdminActionResult> {
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) return { ok: false, error: 'Invalid key.' };
  if (value.length > 2000) return { ok: false, error: 'Value too long.' };
  const call = await adminFn('admin-settings', { action: 'set', key, value });
  return call.ok ? { ok: true } : failure(call.status, call.code);
}

export async function deleteSetting(key: string): Promise<AdminActionResult> {
  const call = await adminFn('admin-settings', { action: 'delete', key });
  return call.ok ? { ok: true } : failure(call.status, call.code);
}

// ---- Audit ----

export async function loadAudit(): Promise<Loaded<AuditRow[]>> {
  const call = await adminFn('admin-members', { action: 'audit' });
  if (!call.ok) return { data: [], error: readFailure(call.status, call.code) };
  return { data: parseAudit(call.data), error: null };
}

// ---- Moderation ----

/** GET wall-moderate has no ok field; a parsed queue IS success. */
export async function loadModerationQueue(): Promise<Loaded<ModerationItem[]>> {
  const call = await adminFn('wall-moderate', undefined, 'GET');
  if (!call.ok) return { data: [], error: readFailure(call.status, call.code) };
  return { data: parseModerationQueue(call.data), error: null };
}

export async function moderatePost(
  postId: string,
  action: 'dismiss' | 'uphold',
): Promise<AdminActionResult> {
  const call = await adminFn('wall-moderate', { action, post_id: postId });
  if (!call.ok) return failure(call.status, call.code);
  // POST answers {success, action}, not {ok}.
  if (call.data.success !== true) return { ok: false, error: GENERIC };
  return { ok: true };
}

// ---- Cohorts ----

/** cohort-create answers {created, cohort}; the legacy success check never matched. */
export async function createCohort(
  name: string,
  startDate: string,
  endDate: string,
): Promise<AdminActionResult> {
  if (!name.trim()) return { ok: false, error: 'Cohort name is required.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: 'Pick both dates.' };
  }
  // cohort-create reads email from the body for its admin check, not a JWT.
  const { memberFn } = await import('@/lib/fn');
  const call = await memberFn('cohort-create', {
    name: name.trim(),
    start_date: startDate,
    end_date: endDate,
  });
  if (!call.ok) return { ok: false, error: call.code || GENERIC };
  if (call.data.created !== true) return { ok: false, error: GENERIC };
  return { ok: true };
}
