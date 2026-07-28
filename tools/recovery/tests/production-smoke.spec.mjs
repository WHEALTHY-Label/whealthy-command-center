import { test, expect } from '@playwright/test';
import {
  isAllowedFinalProductionUrl,
  isAllowedPublicRequest,
  production,
  safeRequestOrigin,
} from '../lib/production-smoke-policy.mjs';

function expectSecureProductionUrl(url) {
  expect(isAllowedFinalProductionUrl(url)).toBe(true);
}

async function allowOnlyPublicGetRequests(page) {
  const blockedRequests = [];

  await page.route('**/*', async (route) => {
    const request = route.request();

    if (isAllowedPublicRequest(request.method(), request.url())) {
      await route.continue();
      return;
    }

    blockedRequests.push({ method: request.method(), origin: safeRequestOrigin(request.url()) });
    await route.abort('blockedbyclient');
  });

  return blockedRequests;
}

test('root application renders without uncaught errors', async ({ page }) => {
  const pageErrors = [];
  const blockedRequests = await allowOnlyPublicGetRequests(page);
  page.on('pageerror', () => pageErrors.push('uncaught page error'));

  const response = await page.goto(production, { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  expectSecureProductionUrl(response?.url() ?? page.url());
  expectSecureProductionUrl(page.url());
  await expect(page).toHaveTitle("WHEALTHY — The Steward's Rhythm");
  await expect(page.locator('body')).not.toBeEmpty();
  expect(blockedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('public application remains usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const blockedRequests = await allowOnlyPublicGetRequests(page);
  const response = await page.goto(production, { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  expectSecureProductionUrl(response?.url() ?? page.url());
  expectSecureProductionUrl(page.url());
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(blockedRequests).toEqual([]);
});

test('page does not expose a service-role credential', async ({ request }) => {
  const response = await request.get(production);

  expect(response.status()).toBe(200);
  expectSecureProductionUrl(response.url());
  const html = await response.text();
  expect(html).not.toMatch(/SUPABASE_SERVICE_ROLE(?:_KEY)?\s*[:=]/i);
  expect(html).not.toMatch(/\bsk_live_[A-Za-z0-9]+/);
});
