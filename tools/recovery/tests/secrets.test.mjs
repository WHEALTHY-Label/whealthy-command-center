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
