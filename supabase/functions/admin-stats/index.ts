// WHEALTHY — admin-stats edge function (v8)
// READ-ONLY aggregates for the admin Control Panel.
// Auth: valid Supabase Auth JWT (Authorization: Bearer) with admin_role master|admin.
// Privacy: stewards are exposed ONLY as anonymous numbers (SW-001…).
// v8 (Ignacio July 21): full-coverage sections — activity (app_events DAU/WAU),
// prayer, scripture, community/skool, circles+cohorts, onboarding, portal orders,
// deeper quiz events. Fixes fast_days (nonexistent) -> habit_ledgers for adherence.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-email",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function requireAdmin(req: Request): Promise<{ ok: true; email: string } | { ok: false; res: Response }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { ok: false, res: json({ error: "not_authorized", reason: "no_token" }, 401) };
  const { data: uData, error: uErr } = await SB.auth.getUser(token);
  const email = uData?.user?.email?.toLowerCase() || "";
  if (uErr || !email) return { ok: false, res: json({ error: "not_authorized", reason: "invalid_token" }, 401) };
  const { data: rows, error: rErr } = await SB.from("approved_members").select("admin_role").ilike("email", email);
  if (rErr) return { ok: false, res: json({ error: "server_error", detail: "role_lookup_failed" }, 500) };
  const isAdmin = (rows || []).some((r: { admin_role: string | null }) => r.admin_role === "master" || r.admin_role === "admin");
  if (!isAdmin) return { ok: false, res: json({ error: "forbidden", reason: "not_admin" }, 403) };
  return { ok: true, email };
}

async function safe<T>(q: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try { const { data, error } = await q; if (error) return []; return data ?? []; }
  catch { return []; }
}
async function safeCount(table: string, filters: (q: any) => any): Promise<number> {
  try {
    const { count, error } = await filters(SB.from(table).select("*", { count: "exact", head: true }));
    if (error) return 0;
    return count ?? 0;
  } catch { return 0; }
}

const DAY = 86400000;
const pct = (a: number, b: number) => b > 0 ? Math.round(a / b * 100) : 0;
const r1 = (n: number) => Math.round(n * 10) / 10;
const inR = (d: string | null, since: number) => !!d && new Date(d).getTime() >= since;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buckets(range: string): { labels: string[]; edges: number[] } {
  const now = Date.now();
  if (range === "7d") {
    const labels: string[] = [], edges: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      labels.push(MONTHS[d.getMonth()] + " " + d.getDate());
      edges.push(new Date(d.toDateString()).getTime());
    }
    return { labels, edges };
  }
  if (range === "30d") {
    const labels = ["W1","W2","W3","W4"], edges: number[] = [];
    for (let i = 3; i >= 0; i--) edges.push(now - (i + 1) * 7 * DAY + DAY);
    return { labels, edges };
  }
  const n = range === "90d" ? 3 : 6;
  const labels: string[] = [], edges: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(new Date(now).getFullYear(), new Date(now).getMonth() - i, 1);
    labels.push(MONTHS[d.getMonth()]);
    edges.push(d.getTime());
  }
  return { labels, edges };
}
function bucketOf(t: number, edges: number[]): number {
  let idx = -1;
  for (let i = 0; i < edges.length; i++) if (t >= edges[i]) idx = i;
  return idx;
}
function series(dates: (string | null)[], edges: number[]): number[] {
  const out = new Array(edges.length).fill(0);
  for (const d of dates) {
    if (!d) continue;
    const i = bucketOf(new Date(d).getTime(), edges);
    if (i >= 0) out[i]++;
  }
  return out;
}
function distinctSeries(rows: { t: string | null; k: string }[], edges: number[]): number[] {
  const sets = edges.map(() => new Set<string>());
  for (const r of rows) {
    if (!r.t) continue;
    const i = bucketOf(new Date(r.t).getTime(), edges);
    if (i >= 0) sets[i].add(r.k);
  }
  return sets.map(s => s.size);
}
function tally<T>(rows: T[], key: (r: T) => string | null): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r); if (!k) continue; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
const distPct = (t: [string, number][], total: number): [string, number][] =>
  t.map(([k, v]) => [k, pct(v, total)] as [string, number]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.res;

    const { range = "30d", bypass_cache = false } = await req.json().catch(() => ({}));
    const cacheKey = String(range);
    if (!bypass_cache) {
      const cached = cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return json(cached.data);
    }

    const days = { "7d": 7, "30d": 30, "90d": 90, "all": 36500 }[range as string] ?? 30;
    const since = Date.now() - days * DAY;
    const sinceISO = new Date(since).toISOString();
    const sinceDate = sinceISO.slice(0, 10);
    const { labels, edges } = buckets(String(range));

    // ---------- fetch everything in parallel (read-only) ----------
    const [members, quizHist, fasts, habitRows, fastHist, entries, profiles, aiPrefs,
      orders, subs, tries, nurture, affs, dLogs,
      evPageView, evQuizOpen, evDrop, evCta, evComplete, evContact,
      timeRows, qQuestionRows,
      prayersT, wallPostsT, wallPraysT, wallAmensT, wallReportsT,
      bibleProg, bibleRefl, mbState, mbMarks, wordDel,
      skoolM, skoolP, circlesT, circleMem, circlePr, cohortsT,
      portalT, appEv] = await Promise.all([
      safe(SB.from("approved_members").select("email,joined_at,member_status,active,active_through,tier,price,archetype_name,archetype,bundle_key,bundle_name,sex,age_band,relationship,kids_count,job_type,hours_band,consumption,load_score,load_season,referred_by,tour_done_at,first_steps")),
      safe(SB.from("quiz_history").select("email,taken_at").gte("taken_at", sinceISO)),
      safe(SB.from("fasts").select("member_email,status,fast_model,duration,start_date,bundle_key,structure_only,ended_day,created_at,ended_at")),
      safe(SB.from("habit_ledgers").select("habit_date,completed").gte("habit_date", sinceDate).limit(5000)),
      safe(SB.from("fast_history").select("weak_rule,created_at").gte("created_at", sinceISO)),
      safe(SB.from("record_entries").select("member_email,entry_date,tone,burned,scribe_line,resurface,created_at").limit(5000)),
      safe(SB.from("member_profile").select("scripture_comfort,scripture_engaged,interaction_count")),
      safe(SB.from("member_ai_prefs").select("scribe_style,landed,missed")),
      safe(SB.from("bundle_orders").select("email,bundle_key,bundle_name,status,created_at")),
      safe(SB.from("bundle_subscriptions").select("email,status,auto_order")),
      safe(SB.from("try_orders").select("email,product_key,product_title,referral_code,created_at")),
      safe(SB.from("nurture_queue").select("sent_at,cancelled,cancel_reason,created_at")),
      safe(SB.from("affiliates").select("ref_id,name")),
      safe(SB.from("daily_logs").select("user_id,log_date,drank_powder,skipped_second_cup,energy_stability,presence_score").gte("log_date", sinceDate).limit(5000)),
      safeCount("page_events", q => q.eq("event_type", "page_view").gte("created_at", sinceISO)),
      safeCount("page_events", q => q.eq("event_type", "quiz_open").gte("created_at", sinceISO)),
      safeCount("page_events", q => q.eq("event_type", "quiz_drop_off").gte("created_at", sinceISO)),
      safeCount("page_events", q => q.eq("event_type", "cta_click").gte("created_at", sinceISO)),
      safeCount("page_events", q => q.eq("event_type", "quiz_complete").gte("created_at", sinceISO)),
      safeCount("page_events", q => q.eq("event_type", "quiz_contact_form").gte("created_at", sinceISO)),
      safe(SB.from("page_events").select("time_on_page").eq("event_type", "time_on_page").gte("created_at", sinceISO).limit(4000)),
      safe(SB.from("page_events").select("event_data").eq("event_type", "quiz_question").gte("created_at", sinceISO).limit(4000)),
      safe(SB.from("prayers").select("member_id,category,state,asked_on,closed_on,outcome,wall_post_id,created_at")),
      safe(SB.from("wall_posts").select("source,status,pray_count,amen_count,answered_at,created_at")),
      safe(SB.from("wall_prays").select("created_at")),
      safe(SB.from("wall_amens").select("created_at")),
      safe(SB.from("wall_reports").select("status,resolved_at,created_at")),
      safe(SB.from("bible_progress").select("email,completed_days,streak")),
      safe(SB.from("bible_reflections").select("member_email,day_number,created_at")),
      safe(SB.from("my_bible_state").select("member_id,mode,updated_at")),
      safe(SB.from("my_bible_marks").select("kind,created_at")),
      safe(SB.from("word_deliveries").select("member_id,delivered_on")),
      safe(SB.from("skool_members").select("email,synced_at")),
      safe(SB.from("skool_posts").select("likes,comments,posted_at")),
      safe(SB.from("circles").select("id,name,created_at")),
      safe(SB.from("circle_members").select("circle_id,member_id")),
      safe(SB.from("circle_prays").select("created_at")),
      safe(SB.from("challenge_cohorts").select("name,status,start_date,end_date")),
      safe(SB.from("portal_orders").select("amount_total,status,product_name,created_at")),
      safe(SB.from("app_events").select("email,created_at").gte("created_at", new Date(Date.now() - 90 * DAY).toISOString()).limit(20000)),
    ]);

    // ---------- members (Freemium classification, v7) ----------
    const isMember = (m: any) => m.member_status === "member" && m.active !== false;
    const memberM = members.filter(isMember);
    const premiumM = memberM.filter((m: any) => m.tier === "premium");
    const freeM = memberM.filter((m: any) => m.tier !== "premium");
    const unverifiedM = members.filter((m: any) => m.member_status !== "member");
    const purchaserEmails = new Set([
      ...orders.map((o: any) => (o.email || "").toLowerCase()),
      ...tries.map((t: any) => (t.email || "").toLowerCase()),
    ].filter(Boolean));
    const today = new Date().toISOString().slice(0, 10);
    const lapsed = members.filter((m: any) => m.active === false || (m.active_through && m.active_through < today)).length;
    const mrr = Math.round(premiumM.reduce((s: number, m: any) => s + (parseFloat(m.price) || 0), 0));

    const growthFree = edges.map(e => {
      const end = e + (edges[1] ? edges[1] - edges[0] : DAY);
      return freeM.filter((m: any) => m.joined_at && new Date(m.joined_at).getTime() < end).length;
    });
    const growthPaid = edges.map(e => {
      const end = e + (edges[1] ? edges[1] - edges[0] : DAY);
      return premiumM.filter((m: any) => m.joined_at && new Date(m.joined_at).getTime() < end).length;
    });

    // ---------- activity (app_events) ----------
    const dayStart = new Date(new Date().toDateString()).getTime();
    const distinctIn = (ms: number) => new Set(appEv.filter((e: any) => new Date(e.created_at).getTime() >= ms).map((e: any) => e.email)).size;
    const activity = {
      dau: distinctIn(dayStart),
      wau: distinctIn(Date.now() - 7 * DAY),
      mau: distinctIn(Date.now() - 30 * DAY),
      opens: appEv.filter((e: any) => inR(e.created_at, since)).length,
      series: distinctSeries(appEv.map((e: any) => ({ t: e.created_at, k: e.email })), edges),
      collectingSince: appEv.length ? appEv.reduce((min: string, e: any) => e.created_at < min ? e.created_at : min, appEv[0].created_at).slice(0, 10) : today,
    };

    // ---------- fasts ----------
    const startedFasts = fasts.filter((f: any) => f.status && f.status !== "revealed");
    const rf = startedFasts.filter((f: any) => inR(f.created_at, since));
    const activeFasts = startedFasts.filter((f: any) => f.status === "active");
    const completedR = rf.filter((f: any) => f.status === "completed");
    const endedR = rf.filter((f: any) => f.status === "ended_early");
    const donePct = (f: any) => f.duration > 0 ? Math.min(100, Math.round(((f.ended_day ?? f.duration) / f.duration) * 100)) : 0;
    const finishedR = rf.filter((f: any) => f.status === "completed" || f.status === "ended_early");
    const avgPct = finishedR.length ? Math.round(finishedR.reduce((s: number, f: any) => s + donePct(f), 0) / finishedR.length) : 0;
    const avgDuration = rf.length ? r1(rf.reduce((s: number, f: any) => s + (f.duration || 0), 0) / rf.length) : 0;
    // v8 adherence fix: habit_ledgers rows are day filings (fast_days never existed)
    const filedR = habitRows.length;
    const elapsed = rf.reduce((s: number, f: any) => {
      if (!f.start_date) return s;
      const el = f.status === "active"
        ? Math.min(f.duration || 0, Math.floor((Date.now() - new Date(f.start_date).getTime()) / DAY) + 1)
        : (f.ended_day ?? f.duration ?? 0);
      return s + Math.max(el, 0);
    }, 0);

    const typeMap = new Map<string, any>();
    for (const f of rf) {
      const name = f.fast_model?.title || "Unnamed Fast";
      const t = typeMap.get(name) ?? { name, figure: f.fast_model?.figure || "", started: 0, completed: 0, pctSum: 0, fin: 0 };
      t.started++;
      if (f.status === "completed") t.completed++;
      if (f.status !== "active") { t.pctSum += donePct(f); t.fin++; }
      typeMap.set(name, t);
    }
    const types = [...typeMap.values()].sort((a, b) => b.started - a.started).map(t => ({
      name: t.name, figure: t.figure, started: t.started, completed: t.completed,
      rate: pct(t.completed, t.started), avgPct: t.fin ? Math.round(t.pctSum / t.fin) : 0,
    }));

    const byPerson = new Map<string, any[]>();
    for (const f of rf) {
      const k = (f.member_email || "").toLowerCase();
      if (!byPerson.has(k)) byPerson.set(k, []);
      byPerson.get(k)!.push(f);
    }
    let pplCompleted = 0, pplEnded = 0, pplActive = 0;
    for (const list of byPerson.values()) {
      if (list.some(f => f.status === "active")) pplActive++;
      if (list.some(f => f.status === "completed")) pplCompleted++;
      else if (list.some(f => f.status === "ended_early")) pplEnded++;
    }

    const dropBuckets: [string, number][] = [["D1",0],["D2",0],["D3",0],["D4",0],["D5",0],["D6",0],["D7+",0]];
    for (const f of endedR) {
      const d = f.ended_day ?? 0;
      dropBuckets[Math.min(Math.max(d, 1), 7) - 1][1]++;
    }
    const weakRules = tally(fastHist.filter((h: any) => inR(h.created_at, since) && h.weak_rule), (h: any) => h.weak_rule).slice(0, 6);

    // ---------- anonymous steward log ----------
    const stewardOrder = [...new Map(startedFasts
      .slice().sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((f: any) => [(f.member_email || "").toLowerCase(), true])).keys()];
    const stewardNo = new Map(stewardOrder.map((e, i) => [e, "SW-" + String(i + 1).padStart(3, "0")]));
    const fmtDate = (d: string | null) => {
      if (!d) return "";
      const x = new Date(d);
      return MONTHS[x.getMonth()] + " " + x.getDate();
    };
    const stewardLog = stewardOrder.map(email => ({
      id: stewardNo.get(email),
      log: startedFasts
        .filter((f: any) => (f.member_email || "").toLowerCase() === email)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((f: any) => ({
          fast: f.fast_model?.title || "Unnamed Fast",
          figure: f.fast_model?.figure || "",
          status: f.status === "completed" ? "completed" : f.status === "active" ? "active" : "ended",
          day: f.status === "active"
            ? Math.min(f.duration || 0, Math.max(1, Math.floor((Date.now() - new Date(f.start_date || f.created_at).getTime()) / DAY) + 1))
            : (f.ended_day ?? f.duration ?? 0),
          total: f.duration ?? 0,
          date: fmtDate(f.start_date || f.created_at),
        })),
    }));

    // ---------- bundles + commerce ----------
    const rMembers = members.filter((m: any) => inR(m.joined_at, since));
    const sugTally = tally(rMembers, (m: any) => m.bundle_name || m.bundle_key);
    const ordersR = orders.filter((o: any) => inR(o.created_at, since));
    const purTally = tally(ordersR, (o: any) => o.bundle_name || o.bundle_key);
    const keys = [...new Set([...sugTally.map(x => x[0]), ...purTally.map(x => x[0])])].slice(0, 8);
    const suggested = keys.map(k => sugTally.find(x => x[0] === k)?.[1] ?? 0);
    const purchased = keys.map(k => purTally.find(x => x[0] === k)?.[1] ?? 0);
    const memberBundle = new Map(members.map((m: any) => [(m.email || "").toLowerCase(), m.bundle_key]));
    const matched = ordersR.filter((o: any) => o.bundle_key && memberBundle.get((o.email || "").toLowerCase()) === o.bundle_key).length;
    let topIdx = 0;
    purchased.forEach((v, i) => { if (v > purchased[topIdx]) topIdx = i; });
    const topName = keys[topIdx] ?? "n/a";

    const triesR = tries.filter((t: any) => inR(t.created_at, since));
    const tryTally = tally(triesR, (t: any) => t.product_title || t.product_key);
    const statusCount = (s: string) => ordersR.filter((o: any) => o.status === s).length;
    const claimers = new Set(ordersR.map((o: any) => (o.email || "").toLowerCase()));
    const memberEmailSet = new Set(memberM.map((m: any) => (m.email || "").toLowerCase()));
    const tryEmails = [...new Set(tries.map((t: any) => (t.email || "").toLowerCase()).filter(Boolean))];
    const tryJoined = tryEmails.filter(e => memberEmailSet.has(e)).length;

    const portalR = portalT.filter((p: any) => inR(p.created_at, since));
    const portal = {
      orders: portalR.length,
      revenue: r1(portalR.reduce((s: number, p: any) => s + (p.amount_total || 0), 0) / 100),
      byStatus: tally(portalR, (p: any) => p.status),
      byProduct: tally(portalR, (p: any) => p.product_name).slice(0, 6),
      trend: series(portalR.map((p: any) => p.created_at), edges),
    };

    // ---------- record ----------
    const entR = entries.filter((e: any) => inR(e.created_at, since));
    const toneOf = (t: string) => entR.filter((e: any) => e.tone === t).length;
    const tot = entR.length || 1;

    // ---------- quiz + demo ----------
    const quizR = quizHist.filter((q: any) => inR(q.taken_at, since));
    const loadScores = members.map((m: any) => m.load_score).filter((x: any) => typeof x === "number");
    const seasonsT = tally(members, (m: any) => m.load_season);
    const dm = members.length || 1;
    const sexT = distPct(tally(members, (m: any) => m.sex), dm);
    const married = members.filter((m: any) => /married|partner/i.test(m.relationship || "")).length;
    const kids = members.map((m: any) => m.kids_count).filter((x: any) => typeof x === "number");
    const avgTime = timeRows.length ? Math.round(timeRows.reduce((s: number, t: any) => s + (t.time_on_page || 0), 0) / timeRows.length) : 0;
    const qFunnel = tally(qQuestionRows, (r: any) => {
      const d = r.event_data || {};
      const v = d.question ?? d.q ?? d.index ?? d.step ?? d.question_number ?? null;
      return v == null ? null : "Q" + v;
    }).sort((a, b) => {
      const na = parseInt(a[0].slice(1)) || 0, nb = parseInt(b[0].slice(1)) || 0;
      return na - nb;
    }).slice(0, 12);

    // ---------- engagement ----------
    const journalers = new Set(entR.map((e: any) => (e.member_email || "").toLowerCase())).size;
    const comfortDist = [1,2,3,4,5].map(l => pct(profiles.filter((p: any) => p.scripture_comfort === l).length, profiles.length));
    const landed = aiPrefs.reduce((s: number, p: any) => s + (p.landed || 0), 0);
    const missed = aiPrefs.reduce((s: number, p: any) => s + (p.missed || 0), 0);
    const dlR = dLogs.filter((d: any) => d.log_date && new Date(d.log_date).getTime() >= since);
    const avgOf = (k: string) => dlR.length ? r1(dlR.reduce((s: number, d: any) => s + (d[k] || 0), 0) / dlR.length) : 0;
    const streaks: [string, number][] = [];
    for (const email of stewardOrder) {
      const dates = [...new Set(entries.filter((e: any) => (e.member_email || "").toLowerCase() === email).map((e: any) => e.entry_date))].sort().reverse();
      let streak = 0, cursor = new Date(today).getTime();
      for (const d of dates) {
        const t = new Date(d as string).getTime();
        if (cursor - t <= DAY) { streak++; cursor = t; } else break;
      }
      if (streak > 0) streaks.push([stewardNo.get(email)!, streak]);
    }
    streaks.sort((a, b) => b[1] - a[1]);

    // ---------- prayer (Hand It Over + walls) ----------
    const prayersR = prayersT.filter((p: any) => inR(p.created_at, since));
    const isAnswered = (p: any) => !!p.closed_on || p.state === "yes" || p.state === "answered";
    const isLifted = (p: any) => !!p.wall_post_id && !isAnswered(p);
    const wallR = wallPostsT.filter((w: any) => inR(w.created_at, since));
    const prayer = {
      handed: prayersR.length,
      handedAll: prayersT.length,
      privateCt: prayersT.filter((p: any) => !isLifted(p) && !isAnswered(p)).length,
      lifted: prayersT.filter(isLifted).length,
      answered: prayersT.filter(isAnswered).length,
      categories: tally(prayersT, (p: any) => p.category),
      wallPosts: wallR.length,
      wallPostsAll: wallPostsT.length,
      testimonies: wallPostsT.filter((w: any) => !!w.answered_at).length,
      praysReceived: wallPostsT.reduce((s: number, w: any) => s + (w.pray_count || 0), 0),
      amens: wallPostsT.reduce((s: number, w: any) => s + (w.amen_count || 0), 0),
      praysGiven: wallPraysT.filter((w: any) => inR(w.created_at, since)).length,
      reportsOpen: wallReportsT.filter((w: any) => !w.resolved_at && w.status !== "resolved").length,
      trend: series(prayersT.map((p: any) => p.created_at), edges),
      wallTrend: series(wallPostsT.map((w: any) => w.created_at), edges),
    };

    // ---------- scripture ----------
    const scripture = {
      b365Users: bibleProg.length,
      b365DaysCompleted: bibleProg.reduce((s: number, b: any) => s + ((b.completed_days || []).length || 0), 0),
      b365AvgStreak: bibleProg.length ? r1(bibleProg.reduce((s: number, b: any) => s + (b.streak || 0), 0) / bibleProg.length) : 0,
      reflections: bibleRefl.filter((r: any) => inR(r.created_at, since)).length,
      reflectionsAll: bibleRefl.length,
      myBibleReaders: mbState.length,
      highlights: mbMarks.filter((m: any) => m.kind === "highlight").length,
      notes: mbMarks.filter((m: any) => m.kind === "note").length,
      wordDeliveries: wordDel.filter((w: any) => w.delivered_on && w.delivered_on >= sinceDate).length,
      wordDeliveriesAll: wordDel.length,
      comfort: comfortDist,
      engagedPct: pct(profiles.filter((p: any) => (p.scripture_engaged || 0) > 0).length, profiles.length),
    };

    // ---------- community / skool ----------
    const skoolPostsR = skoolP.filter((p: any) => inR(p.posted_at, since));
    const community = {
      skoolMembers: skoolM.length,
      skoolEmailless: skoolM.filter((m: any) => !m.email).length,
      skoolPosts: skoolP.length,
      skoolPostsRange: skoolPostsR.length,
      likes: skoolP.reduce((s: number, p: any) => s + (p.likes || 0), 0),
      comments: skoolP.reduce((s: number, p: any) => s + (p.comments || 0), 0),
      lastSync: skoolM.length ? skoolM.reduce((mx: string, m: any) => (m.synced_at || "") > mx ? m.synced_at : mx, "").slice(0, 10) : null,
      postTrend: series(skoolP.map((p: any) => p.posted_at), edges),
    };

    // ---------- groups (circles + cohorts) ----------
    const groups = {
      circles: circlesT.length,
      circleMembers: circleMem.length,
      circlePrays: circlePr.filter((c: any) => inR(c.created_at, since)).length,
      circlePraysAll: circlePr.length,
      cohorts: cohortsT.map((c: any) => [c.name, c.status, c.start_date, c.end_date]),
      activeCohorts: cohortsT.filter((c: any) => c.status === "active" || c.status === "open").length,
    };

    // ---------- onboarding ----------
    const FS_KEYS = ["bundle","word","wall","record","community","fast","code"];
    const fsCounts = FS_KEYS.map(k => [k, memberM.filter((m: any) => m.first_steps && m.first_steps[k] === true).length] as [string, number]);
    const stepsDone = memberM.map((m: any) => FS_KEYS.filter(k => m.first_steps && m.first_steps[k] === true).length);
    const onboarding = {
      tourDone: memberM.filter((m: any) => m.tour_done_at).length,
      tourPct: pct(memberM.filter((m: any) => m.tour_done_at).length, memberM.length),
      firstSteps: fsCounts,
      avgSteps: stepsDone.length ? r1(stepsDone.reduce((a: number, b: number) => a + b, 0) / stepsDone.length) : 0,
      complete7: stepsDone.filter((n: number) => n === 7).length,
    };

    // ---------- nurture / affiliates ----------
    const nurtureR = nurture.filter((n: any) => inR(n.created_at, since));
    const referredR = rMembers.filter((m: any) => m.referred_by).length;
    const refTally = tally(rMembers.filter((m: any) => m.referred_by), (m: any) => m.referred_by);
    const refName = new Map(affs.map((a: any) => [a.ref_id, a.name || a.ref_id]));

    // ---------- trends ----------
    const trends = {
      fastsStarted: series(rf.map((f: any) => f.created_at), edges),
      fastsCompleted: series(rf.filter((f: any) => f.status === "completed").map((f: any) => f.ended_at || f.created_at), edges),
      orders: series(ordersR.map((o: any) => o.created_at), edges),
      tryOrdersTrend: series(triesR.map((t: any) => t.created_at), edges),
      durations: tally(rf, (f: any) => f.duration ? f.duration + " days" : null),
      logsFiled: series(dlR.map((d: any) => d.log_date), edges),
      powderDays: series(dlR.filter((d: any) => d.drank_powder).map((d: any) => d.log_date), edges),
      entriesFiled: series(entR.map((e: any) => e.created_at), edges),
      burned: series(entR.filter((e: any) => e.burned).map((e: any) => e.created_at), edges),
    };

    // ---------- payload ----------
    const payload = {
      live: true,
      members: {
        free: freeM.length, unverified: unverifiedM.length, paid: premiumM.length,
        purchasers: purchaserEmails.size,
        conv: r1(pct(premiumM.length, memberM.length)),
        dFree: freeM.filter((m: any) => inR(m.joined_at, since)).length,
        dUnverified: unverifiedM.filter((m: any) => inR(m.joined_at, since)).length,
        dPaid: premiumM.filter((m: any) => inR(m.joined_at, since)).length,
        dBuyers: new Set(ordersR.map((o: any) => (o.email || "").toLowerCase())).size,
      },
      activity,
      growth: { labels, free: growthFree, paid: growthPaid },
      funnel: { stages: [
        ["All Profiles", members.length],
        ["Quiz Taken", quizR.length],
        ["Fast Started", rf.length],
        ["Bundle Suggested", rMembers.filter((m: any) => m.bundle_key).length],
        ["Purchased", ordersR.length],
      ]},
      fasts: {
        started: rf.length, active: activeFasts.length,
        completed: completedR.length, endedEarly: endedR.length,
        completionRate: pct(completedR.length, rf.length),
        avgPct, adherence: pct(filedR, elapsed), avgDuration,
        types,
      },
      prayer,
      scripture,
      community,
      groups,
      onboarding,
      bundles: {
        keys, suggested, purchased,
        matchRate: pct(matched, ordersR.length),
        top: {
          name: topName, mark: String(topName).split(" ")[0].toUpperCase(),
          suggested: suggested[topIdx] ?? 0, purchased: purchased[topIdx] ?? 0,
          rate: pct(purchased[topIdx] ?? 0, suggested[topIdx] || 1),
        },
      },
      tryOrders: tryTally,
      portal,
      record: {
        entries: entR.length,
        heavy: pct(toneOf("heavy"), tot), win: pct(toneOf("win"), tot), mixed: pct(toneOf("mixed"), tot),
        burned: entR.filter((e: any) => e.burned).length,
      },
      quiz: {
        pageViews: evPageView, starts: evQuizOpen, completions: quizR.length,
        rate: pct(quizR.length, evQuizOpen), dropoffs: evDrop, ctaClicks: evCta,
        completes: evComplete, contactForms: evContact, avgTimeOnPage: avgTime,
        questionFunnel: qFunnel,
        avgLoad: loadScores.length ? r1(loadScores.reduce((a: number, b: number) => a + b, 0) / loadScores.length) : 0,
        archetypes: tally(members, (m: any) => m.archetype_name || m.archetype),
        seasons: distPct(seasonsT, dm),
      },
      demo: {
        sex: sexT.length ? sexT : [["Unknown", 100]],
        age: distPct(tally(members, (m: any) => m.age_band), dm),
        job: distPct(tally(members, (m: any) => m.job_type), dm),
        hours: distPct(tally(members, (m: any) => m.hours_band), dm),
        consumption: distPct(tally(members, (m: any) => m.consumption), dm),
        marriedPct: pct(married, members.length),
        avgKids: kids.length ? r1(kids.reduce((a: number, b: number) => a + b, 0) / kids.length) : 0,
      },
      memberHealth: {
        churned: lapsed, mrr,
        nurture: {
          queued: nurture.filter((n: any) => !n.sent_at && !n.cancelled).length,
          sent: nurtureR.filter((n: any) => n.sent_at).length,
          joined: nurture.filter((n: any) => n.cancelled && n.cancel_reason === "community_joined").length,
        },
      },
      affiliates: {
        registered: affs.length,
        active: refTally.length,
        referred: referredR,
        tryRefs: triesR.filter((t: any) => t.referral_code).length,
        top: refTally.slice(0, 6).map(([ref, n]) => [refName.get(ref) ?? ref, n]),
      },
      engagement: {
        journalers,
        entriesPerMember: journalers ? r1(entR.length / journalers) : 0,
        avgStreak: streaks.length ? r1(streaks.reduce((s, x) => s + x[1], 0) / streaks.length) : 0,
        comfort: comfortDist,
        scriptureEngagedPct: scripture.engagedPct,
        avgInteractions: profiles.length ? r1(profiles.reduce((s: number, p: any) => s + (p.interaction_count || 0), 0) / profiles.length) : 0,
        scribe: {
          landedRate: pct(landed, landed + missed),
          briefPct: pct(aiPrefs.filter((p: any) => p.scribe_style === "brief").length, aiPrefs.length),
        },
        dailyLogs: {
          filed: dlR.length,
          avgEnergy: avgOf("energy_stability"),
          avgPresence: avgOf("presence_score"),
          powderPct: pct(dlR.filter((d: any) => d.drank_powder).length, dlR.length),
          skipPct: pct(dlR.filter((d: any) => d.skipped_second_cup).length, dlR.length),
        },
        leaderboard: streaks.slice(0, 5),
      },
      fastsExtra: {
        people: {
          started: byPerson.size, completed: pplCompleted, endedEarly: pplEnded,
          active: pplActive, pct: pct(pplCompleted, byPerson.size),
        },
        structureOnlyPct: pct(rf.filter((f: any) => f.structure_only).length, rf.length),
        dropoff: dropBuckets,
        weakRules,
      },
      bundleOps: {
        claimRate: pct(claimers.size, memberM.length),
        pending: statusCount("pending"), confirmed: statusCount("confirmed"),
        shipped: statusCount("shipped"), skipped: statusCount("skipped"),
        tryToMember: pct(tryJoined, tryEmails.length),
        subs: {
          active: subs.filter((s: any) => s.status === "active").length,
          paused: subs.filter((s: any) => s.status === "paused").length,
          cancelled: subs.filter((s: any) => s.status === "cancelled").length,
          autoPct: pct(subs.filter((s: any) => s.auto_order).length, subs.length),
        },
      },
      recordExtra: {
        scribePct: pct(entR.filter((e: any) => e.scribe_line).length, entR.length),
        resurfaced: entR.filter((e: any) => e.resurface).length,
      },
      trends,
      stewardLog,
    };
    cache.set(cacheKey, { data: payload, timestamp: Date.now() });
    return json(payload);
  } catch (e) {
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}
