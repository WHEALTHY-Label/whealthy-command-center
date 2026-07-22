// crm-health v4 - diagnostic + repair for the baknd CRM wiring.
// Secret-gated. v4: backfill excludes placeholder identities (source skool_no_email
// and @unknown.* fabricated emails) so no junk contacts reach the CRM.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-webhook-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function authHeaders(style: string, key: string): Record<string, string> {
  switch (style) {
    case 'bearer': return { Authorization: `Bearer ${key}` };
    case 'raw': return { Authorization: key };
    case 'x-api-key': return { 'X-API-Key': key };
    case 'api-key': return { 'Api-Key': key };
    case 'apikey': return { apikey: key };
    default: return { Authorization: `Bearer ${key}` };
  }
}

function sb() { return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); }

async function resolveKey(): Promise<{ key: string; from: string }> {
  const env = (Deno.env.get('BAKND_API_KEY') || '').trim();
  const isPlaceholder = !env || env === 'BAKND_API_KEY' || env.length < 16;
  if (!isPlaceholder) return { key: env, from: 'env' };
  const { data } = await sb().from('app_config').select('value').eq('key', 'baknd_api_key').maybeSingle();
  if (data?.value) return { key: String(data.value).trim(), from: 'app_config' };
  return { key: env, from: env ? 'env-placeholder' : 'missing' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const webhookSecret = Deno.env.get('NURTURE_WEBHOOK_SECRET');
  if (!webhookSecret) return j({ error: 'nurture_webhook_secret_not_configured' }, 503);
  if (req.headers.get('x-webhook-secret') !== webhookSecret) return j({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'diag';
  const { key, from } = await resolveKey();
  const url = Deno.env.get('BAKND_API_URL') || 'https://whealthylabel.com/api/site/contacts';
  if (!key) return j({ error: 'no key available', from }, 500);

  const keyMeta = { source: from, length: key.length, head: key.slice(0, 4) + '...', placeholderInEnv: (Deno.env.get('BAKND_API_KEY') || '').trim() === 'BAKND_API_KEY' };

  if (mode === 'diag') {
    const styles = ['bearer', 'raw', 'x-api-key', 'api-key', 'apikey'];
    const qaPayload = { email: 'crm.wiring.check@whealthy-qa.test', name: 'CRM Wiring Check', phone: '', tags: ['QA: CRM Wiring Check'], properties: [], subscribed: false, note: 'Diagnostic upsert from crm-health. Safe to delete.' };
    const results: Record<string, unknown>[] = [];
    for (const style of styles) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { ...authHeaders(style, key), 'Content-Type': 'application/json', 'User-Agent': 'Whealthy/1.0.1' }, body: JSON.stringify(qaPayload) });
        const text = (await res.text()).slice(0, 200);
        results.push({ style, status: res.status, body: text });
        if (res.ok) break;
      } catch (e) { results.push({ style, error: String(e).slice(0, 150) }); }
    }
    return j({ keyMeta, url, results });
  }

  if (mode === 'backfill') {
    const style = body.auth || 'bearer';
    const limit = Math.min(Number(body.limit) || 100, 200);
    const { data: members, error } = await sb().from('approved_members')
      .select('email,name,last_name,phone,archetype,archetype_name,bundle_key,bundle_name,member_status,source,skool_handle')
      .neq('source', 'qa-test')
      .neq('source', 'skool_no_email')
      .not('email', 'is', null)
      .limit(limit);
    if (error) return j({ error: error.message }, 500);
    let ok = 0, fail = 0, skipped = 0;
    const failures: unknown[] = [];
    for (const m of (members || [])) {
      if (!m.email || !m.email.includes('@') || m.email.endsWith('.test') || m.email.includes('@unknown.')) { skipped++; continue; }
      const tags = [m.member_status === 'member' ? 'Community Member' : 'Quiz Completed'];
      if (m.archetype_name) tags.push(m.archetype_name);
      if (m.bundle_name) tags.push(`Suggestion: ${m.bundle_name}`);
      tags.push(`Source: ${m.source || 'unknown'}`);
      tags.push('Backfill 2026-07-20');
      const props: Array<{ name: string; type: string; value: string }> = [];
      if (m.archetype) props.push({ name: 'archetype', type: 'string', value: m.archetype });
      if (m.bundle_key) props.push({ name: 'bundle_key', type: 'string', value: m.bundle_key });
      if (m.member_status) props.push({ name: 'member_status', type: 'string', value: m.member_status });
      if (m.skool_handle) props.push({ name: 'skool_handle', type: 'string', value: m.skool_handle });
      try {
        const res = await fetch(url, { method: 'POST', headers: { ...authHeaders(style, key), 'Content-Type': 'application/json', 'User-Agent': 'Whealthy/1.0.1' }, body: JSON.stringify({ email: m.email, name: [m.name, m.last_name].filter(Boolean).join(' ').trim() || m.email, phone: m.phone || '', tags, properties: props, subscribed: true, note: 'Backfilled from the Stewards Rhythm member db.' }) });
        if (res.ok) ok++; else { fail++; if (failures.length < 5) failures.push({ email: m.email, status: res.status, body: (await res.text()).slice(0, 120) }); }
      } catch (e) { fail++; if (failures.length < 5) failures.push({ email: m.email, error: String(e).slice(0, 120) }); }
      await new Promise(r => setTimeout(r, 150));
    }
    return j({ mode, style, keySource: from, pushed_ok: ok, failed: fail, skipped, failures });
  }

  return j({ error: 'unknown mode' }, 400);
});
