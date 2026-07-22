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
