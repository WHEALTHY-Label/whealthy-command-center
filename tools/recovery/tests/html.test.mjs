import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRouteInventory, validateLiveHtml } from '../lib/html.mjs';

const valid = `<!DOCTYPE html>
<html><head><title>WHEALTHY — The Steward's Rhythm</title></head>
<body><script>
const SUPABASE_URL = 'https://yzaxzmuuvozonhgwhlim.supabase.co';
go('dash'); go('rhythm'); window.location.hash = view;
</script></body></html>`;

test('validateLiveHtml accepts the WHEALTHY document contract', () => {
  const result = validateLiveHtml(valid.repeat(5000));
  assert.equal(result.title, "WHEALTHY — The Steward's Rhythm");
  assert.ok(result.byteLength > 500_000);
});

test('validateLiveHtml rejects a login or proxy error page', () => {
  assert.throws(() => validateLiveHtml('<html>Redirecting...</html>'), /doctype/i);
});

test('extractRouteInventory returns sorted unique hash views', () => {
  assert.deepEqual(extractRouteInventory(valid).hashes, ['dash', 'rhythm']);
});
