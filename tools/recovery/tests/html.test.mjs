import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRouteInventory, validateFinalProductionUrl, validateLiveHtml } from '../lib/html.mjs';

const valid = `<!DOCTYPE html>
<html><head><title>WHEALTHY — The Steward's Rhythm</title></head>
<body><script>
const SUPABASE_URL = 'https://yzaxzmuuvozonhgwhlim.supabase.co';
go('dash'); go('rhythm'); window.location.hash = view;
</script></body></html>`;

const appMarkup = '<nav id="navDash"></nav><main id="dashView"></main><section id="rhythmView"></section>';
const validApp = valid.replace('</body>', `${appMarkup}</body>`);

test('validateLiveHtml accepts the WHEALTHY document contract', () => {
  const result = validateLiveHtml(validApp.repeat(5000));
  assert.equal(result.title, "WHEALTHY — The Steward's Rhythm");
  assert.ok(result.byteLength > 500_000);
});

test('validateLiveHtml rejects a login or proxy error page', () => {
  assert.throws(() => validateLiveHtml('<html>Redirecting...</html>'), /doctype/i);
});

test('validateLiveHtml rejects a padded page without WHEALTHY app structure', () => {
  assert.throws(
    () => validateLiveHtml(valid.repeat(5000)),
    /app marker/i,
  );
});

test('extractRouteInventory returns sorted unique hash views', () => {
  assert.deepEqual(extractRouteInventory(valid).hashes, ['dash', 'rhythm']);
});

test('validateFinalProductionUrl accepts the canonical production hostnames over HTTPS', () => {
  assert.doesNotThrow(() => validateFinalProductionUrl('https://thestewardsrhythm.com/'));
  assert.doesNotThrow(() => validateFinalProductionUrl('https://www.thestewardsrhythm.com/app'));
});

test('validateFinalProductionUrl rejects off-domain and HTTP final URLs', () => {
  assert.throws(() => validateFinalProductionUrl('https://proxy.example/'), /hostname/i);
  assert.throws(() => validateFinalProductionUrl('http://thestewardsrhythm.com/'), /HTTPS/i);
});
