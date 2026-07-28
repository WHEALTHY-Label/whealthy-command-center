import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSecrets } from '../lib/secrets.mjs';

test('allows the checked-in Supabase publishable anon JWT', () => {
  assert.deepEqual(scanSecrets("const SUPABASE_ANON='eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature';"), []);
});

test('blocks service-role and provider secret assignments', () => {
  const findings = scanSecrets("SUPABASE_SERVICE_ROLE_KEY='secret'\nSTRIPE_SECRET_KEY='sk_live_example'");
  assert.deepEqual(findings.map(({ kind }) => kind), ['supabase-service-role', 'stripe-secret']);
});

test('blocks PEM private keys', () => {
  assert.equal(scanSecrets('-----BEGIN PRIVATE KEY-----').length, 1);
});

test('blocks known provider credential assignments with values', () => {
  const findings = scanSecrets([
    "BAKND_API_KEY='example-baknd-key'",
    "RESEND_API_KEY='re_example_key'",
    "ELEVENLABS_API_KEY='example-elevenlabs-key'",
    "SHOPIFY_ACCESS_TOKEN='shpat_example_token'",
    "OPENAI_API_KEY='sk-example-legacy-key'",
  ].join('\n'));
  assert.deepEqual(findings.map(({ kind }) => kind), [
    'baknd-api-key',
    'resend-api-key',
    'elevenlabs-api-key',
    'shopify-access-token',
    'openai-api-key',
  ]);
});

test('allows publishable Supabase anon material alongside provider names', () => {
  assert.deepEqual(scanSecrets("SUPABASE_ANON='eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature'"), []);
});

test('blocks known credential keys when quoted in JSON-shaped objects', () => {
  const findings = scanSecrets([
    '{',
    '  "SUPABASE_SERVICE_ROLE_KEY": "example-service-role",',
    '  "STRIPE_SECRET_KEY": "sk_test_example",',
    '  "BAKND_API_KEY": "example-baknd-key",',
    '  "RESEND_API_KEY": "re_example_key",',
    '  "ELEVENLABS_API_KEY": "example-elevenlabs-key",',
    '  "SHOPIFY_ACCESS_TOKEN": "shpat_example_token",',
    '  "OPENAI_API_KEY": "sk-example-legacy-key"',
    '}',
  ].join('\n'));
  assert.deepEqual(findings.map(({ kind }) => kind), [
    'supabase-service-role',
    'stripe-secret',
    'baknd-api-key',
    'resend-api-key',
    'elevenlabs-api-key',
    'shopify-access-token',
    'openai-api-key',
  ]);
});

test('does not treat prefixed identifiers as credential assignment keys', () => {
  const findings = scanSecrets("NOT_BAKND_API_KEY='example-value'");
  assert.deepEqual(findings, []);
});

test('blocks generic camelCase credential literals but allows environment lookups and placeholders', () => {
  const findings = scanSecrets([
    "const nurtureSecret = 'not-a-real-secret';",
    "const nurtureFromEnv = Deno.env.get('NURTURE_WEBHOOK_SECRET');",
    "const webhookToken = '[REDACTED]';",
    "const webhookKey = '<configure-in-environment>';",
  ].join('\n'));
  assert.deepEqual(findings.map(({ kind }) => kind), ['generic-credential-assignment']);
});

test('blocks uppercase credential assignments without flagging noncredential data keys', () => {
  const findings = scanSecrets([
    "const SECRET = 'shared-webhook-value';",
    "const WEBHOOK_SECRET = 'another-shared-value';",
    "const CONTENT_KEY = 'welcome_email';",
  ].join('\n'));
  assert.deepEqual(findings.map(({ kind }) => kind), [
    'generic-credential-assignment',
    'generic-credential-assignment',
  ]);
});

test('blocks webhook header and comparison literals', () => {
  const findings = scanSecrets([
    "headers: { 'x-webhook-secret': 'shared-webhook-value' },",
    "if (headerSecret !== 'shared-webhook-value') return unauthorized();",
    "if (req.headers.get('x-webhook-secret') !== 'shared-webhook-value') return unauthorized();",
  ].join('\n'));
  assert.deepEqual(findings.map(({ kind }) => kind), [
    'credential-header-literal',
    'credential-comparison-literal',
    'credential-comparison-literal',
  ]);
});

test('blocks safely detectable encoded credential literals', () => {
  const findings = scanSecrets([
    "const webhookSecret = atob('c2hhcmVkLXdlYmhvb2stdmFsdWU=');",
    "const API_TOKEN = Buffer.from('c2hhcmVkLXZhbHVl', 'base64');",
    "const productKey = atob('cHJvZHVjdC1zbHVn');",
  ].join('\n'));
  assert.deepEqual(findings.map(({ kind }) => kind), [
    'encoded-credential-literal',
    'encoded-credential-literal',
  ]);
});
