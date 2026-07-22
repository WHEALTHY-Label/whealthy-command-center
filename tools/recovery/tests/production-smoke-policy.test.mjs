import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedFinalProductionUrl,
  isAllowedPublicRequest,
  safeRequestOrigin,
} from '../lib/production-smoke-policy.mjs';

test('allows only observed HTTPS public GET/HEAD dependencies', () => {
  assert.equal(isAllowedPublicRequest('GET', 'https://thestewardsrhythm.com/'), true);
  assert.equal(isAllowedPublicRequest('HEAD', 'https://www.thestewardsrhythm.com/assets/app.js'), true);
  assert.equal(isAllowedPublicRequest('GET', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'), true);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/gg2-4178551.jpeg?format=webp'), true);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap'), true);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.gstatic.com/s/dmsans/font.woff2'), true);
});

test('rejects mutations and non-allowlisted HTTPS origins or paths', () => {
  assert.equal(isAllowedPublicRequest('POST', 'https://thestewardsrhythm.com/'), false);
  assert.equal(isAllowedPublicRequest('GET', 'http://thestewardsrhythm.com/'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://evil.example/assets/app.js'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://thestewardsrhythm.com:444/'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://user:pass@thestewardsrhythm.com/'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://thestewardsrhythm.com/#fragment'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js?token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/gg2-4178551.jpeg?token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/gg2-4178551.jpeg?format=jpeg'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/gg2-4178551.jpeg?format=webp&format=webp'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/gg2-4178551.jpeg?format=webp&width=640'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com:444/s/07333876398906327/thumbnails/640x480/LEMON/gg2-4178551.jpeg?format=webp'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://user:pass@content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/gg2-4178551.jpeg?format=webp'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/%2e%2e%2Fsecret.jpeg?format=webp'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/%252e%252e%252Fsecret.jpeg?format=webp'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/%2E%2E%2fsecret.jpeg?format=webp'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/bad%name.jpeg?format=webp'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.gstatic.com/s/dmsans/font.woff2?token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://cdn.jsdelivr.net/npm/other-package/index.js'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/other-account/thumbnails/640x480/LEMON/image.jpeg'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=block'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700'), false);
});

test('allows only HTTPS production-root final navigations and sanitizes diagnostics', () => {
  assert.equal(isAllowedFinalProductionUrl('https://thestewardsrhythm.com/'), true);
  assert.equal(isAllowedFinalProductionUrl('https://www.thestewardsrhythm.com/'), true);
  assert.equal(isAllowedFinalProductionUrl('http://thestewardsrhythm.com/'), false);
  assert.equal(isAllowedFinalProductionUrl('https://thestewardsrhythm.com/account'), false);
  assert.equal(isAllowedFinalProductionUrl('https://thestewardsrhythm.com:444/'), false);
  assert.equal(isAllowedFinalProductionUrl('https://user:pass@thestewardsrhythm.com/'), false);
  assert.equal(isAllowedFinalProductionUrl('https://thestewardsrhythm.com/?token=secret'), false);
  assert.equal(isAllowedFinalProductionUrl('https://thestewardsrhythm.com/#fragment'), false);
  assert.equal(safeRequestOrigin('https://fonts.googleapis.com/css2?family=DM+Sans&token=secret'), 'https://fonts.googleapis.com');
});

test('rejects production URLs with credentials, queries, fragments, or alternate ports', () => {
  assert.equal(isAllowedPublicRequest('GET', 'https://thestewardsrhythm.com:444/'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://user:pass@thestewardsrhythm.com/'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://thestewardsrhythm.com/?token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://thestewardsrhythm.com/#fragment'), false);
});

test('rejects CDN queries and Google Fonts credentials or unobserved parameters', () => {
  assert.equal(isAllowedPublicRequest('GET', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js?token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://content.app-sources.com/s/07333876398906327/thumbnails/640x480/LEMON/gg2-4178551.jpeg?token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.gstatic.com/s/dmsans/font.woff2?token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&token=secret'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=block'), false);
});

test('rejects malformed, duplicate, and unobserved Google Fonts family values', () => {
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700'), false);
  assert.equal(isAllowedPublicRequest('GET', 'https://fonts.googleapis.com/css2?display=swap'), false);
});
