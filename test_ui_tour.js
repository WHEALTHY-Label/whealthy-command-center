/**
 * test_ui_tour.js — Playwright test: Guided Tour + First Steps
 *
 * Coverage:
 *  1. Tour fires when tour_done_at is null
 *  2. Skip sets the flag and POSTs { done: true } (not action/email)
 *  3. Steps hit every nav id in the sidebar (At a Glance removed)
 *  4. Admin step conditional (only for master/admin)
 *  5. First Steps card renders on Home after tour (server flag keys)
 *  6. Checklist auto-checks on visit (server keys: bundle/word/wall/record/community/fast/code)
 *  7. 7/7 celebration
 *  8. Mobile bottom-sheet mode
 *  9. Retake tour from More section
 * 10. Keyboard navigation
 * 11. Wire shape: POST body uses { done } and { steps }, not action/first_steps/email
 * 12. Auth: no session → no POST (anon key never sent)
 *
 * Run: npx playwright test test_ui_tour.js --headed
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5500/index.html';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@whealthy.com';

/** Server-whitelist flag keys (from tour-state v2 contract) */
const SERVER_KEYS = ['bundle', 'word', 'wall', 'record', 'community', 'fast', 'code'];

// Helper: wait for the app to boot and simulate login
async function loginAndBoot(page, opts = {}) {
  await page.goto(BASE_URL);
  await page.waitForTimeout(1500);

  await page.evaluate((o) => {
    window.MEMBER_EMAIL = o.email;
    window.MEMBER_NAME = o.name || 'Test Steward';
    window.MEMBER_ID = 'test-id-123';
    window.ADMIN_ROLE = o.adminRole || null;
    window.TOUR_DONE_AT = o.tourDoneAt || null;
    window.FIRST_STEPS = o.firstSteps || {};
    window.REC = { archetype_name: 'The Morning Dependency', pattern: 'the-morning-dependency' };
    window.S = window.S || { fast: {}, entries: [], profile: {} };
  }, {
    email: opts.email || TEST_EMAIL,
    name: opts.name || 'Ignacio',
    adminRole: opts.adminRole || null,
    tourDoneAt: opts.tourDoneAt || null,
    firstSteps: opts.firstSteps || {}
  });

  // Close the gate if present
  await page.evaluate(() => {
    const gate = document.getElementById('waGate');
    if (gate) gate.style.display = 'none';
    const content = document.getElementById('appLayout') || document.getElementById('sidebar') || document.querySelector('.dash-container');
    if (content) content.style.display = '';
    const mh = document.querySelector('.mobile-header');
    if (mh) mh.style.display = '';
  });
}


/* ═══════════════════════════════════════════════════
   TEST 1: Tour fires when tour_done_at is null
   ═══════════════════════════════════════════════════ */
test('Tour fires when flag is null', async ({ page }) => {
  await loginAndBoot(page, { tourDoneAt: null });

  await page.evaluate(() => {
    if (typeof startGuidedTour === 'function') startGuidedTour();
  });

  const overlay = page.locator('#tourDimOverlay');
  await expect(overlay).toHaveClass(/active/);

  const card = page.locator('#tourCard');
  await expect(card).toHaveClass(/active/);

  const title = card.locator('.tour-card__title');
  await expect(title).toContainText('Morning Dependency');
});


/* ═══════════════════════════════════════════════════
   TEST 2: Skip sets tour_done_at
   ═══════════════════════════════════════════════════ */
test('Skip sets tour_done_at', async ({ page }) => {
  await loginAndBoot(page, { tourDoneAt: null });
  await page.evaluate(() => startGuidedTour());

  await page.click('.tour-card__skip');

  const overlay = page.locator('#tourDimOverlay');
  await expect(overlay).not.toHaveClass(/active/);

  const flag = await page.evaluate(() => window.TOUR_DONE_AT);
  expect(flag).toBeTruthy();
});


/* ═══════════════════════════════════════════════════
   TEST 3: Steps hit every nav id (At a Glance removed)
   ═══════════════════════════════════════════════════ */
test('All steps spotlight correct nav ids', async ({ page }) => {
  await loginAndBoot(page, { tourDoneAt: null });
  await page.evaluate(() => startGuidedTour());

  // 18 steps for non-admin (20 original - 1 admin - 1 At a Glance removed)
  const expectedNavIds = [
    null,                // Step 0: Welcome (no target)
    'navDash',           // Step 1
    'navClaim',          // Step 2
    'navTryall',         // Step 3
    // navLeaderboard removed
    'navRecord',         // Step 4 (was 5)
    'navCommunity',      // Step 5
    'navEnterCommunity', // Step 6
    'navPrayer',         // Step 7
    'navWall',           // Step 8
    'navTestimony',      // Step 9
    'navMe',             // Step 10
    'navBible',          // Step 11
    'navFast',           // Step 12
    'navCohort',         // Step 13
    'navCircle',         // Step 14
    'navAffiliate',      // Step 15
    'navPortal',         // Step 16
    null                 // Finish (no target)
  ];

  for (let i = 0; i < expectedNavIds.length; i++) {
    const navId = expectedNavIds[i];

    if (navId) {
      const hasSpotlight = await page.evaluate((id) => {
        const el = document.getElementById(id);
        return el ? el.classList.contains('tour-spotlight-active') : false;
      }, navId);
      expect(hasSpotlight).toBe(true);
    }

    if (i < expectedNavIds.length - 1) {
      await page.click('.tour-card__btn--next');
      await page.waitForTimeout(200);
    }
  }

  // Complete the tour
  await page.click('.tour-card__btn--next');
  const flag = await page.evaluate(() => window.TOUR_DONE_AT);
  expect(flag).toBeTruthy();
});


/* ═══════════════════════════════════════════════════
   TEST 4: Admin step conditional
   ═══════════════════════════════════════════════════ */
test('Admin step only for admin/master', async ({ page }) => {
  // Non-admin: 18 steps (20 - 1 admin - 1 At a Glance)
  await loginAndBoot(page, { tourDoneAt: null, adminRole: null });
  await page.evaluate(() => startGuidedTour());

  const stepCount = await page.evaluate(() => {
    return document.querySelectorAll('.tour-card__dot').length;
  });
  expect(stepCount).toBe(18);

  await page.evaluate(() => skipTour());

  // Admin: 19 steps (20 - 1 At a Glance)
  await loginAndBoot(page, { tourDoneAt: null, adminRole: 'master' });
  await page.evaluate(() => startGuidedTour());

  const adminStepCount = await page.evaluate(() => {
    return document.querySelectorAll('.tour-card__dot').length;
  });
  expect(adminStepCount).toBe(19);
});


/* ═══════════════════════════════════════════════════
   TEST 5: First Steps card renders with SERVER flag keys
   ═══════════════════════════════════════════════════ */
test('First Steps card visible on Home after tour (server keys)', async ({ page }) => {
  await loginAndBoot(page, {
    tourDoneAt: '2026-07-20T00:00:00Z',
    firstSteps: { bundle: true } // SERVER key, not bundle_visited
  });

  await page.evaluate(() => {
    if (typeof renderDash === 'function') renderDash();
  });

  const card = page.locator('#firstStepsCard');
  await expect(card).toBeVisible();

  await expect(card.locator('.first-steps-card__progress-text')).toContainText('1 of 7');

  // The bundle row (server key) should be completed
  const bundleRow = card.locator('[data-fs-key="bundle"]');
  await expect(bundleRow).toHaveClass(/completed/);

  // 6 unchecked rows get Go →
  const goButtons = card.locator('.first-steps-card__go');
  const count = await goButtons.count();
  expect(count).toBe(6);
});


/* ═══════════════════════════════════════════════════
   TEST 6: Checklist auto-checks on visit (server keys)
   ═══════════════════════════════════════════════════ */
test('First Steps auto-checks with server flag keys', async ({ page }) => {
  await loginAndBoot(page, {
    tourDoneAt: '2026-07-20T00:00:00Z',
    firstSteps: {}
  });

  await page.evaluate(() => {
    if (typeof renderDash === 'function') renderDash();
  });

  // Visit bible → should set 'word' (not 'word_opened')
  await page.evaluate(() => reportFirstStepVisit('bible'));
  const wordFlag = await page.evaluate(() => window.FIRST_STEPS.word);
  expect(wordFlag).toBe(true);

  // Visit affiliate → should set 'code' (not 'affiliate_visited')
  await page.evaluate(() => reportFirstStepVisit('affiliate'));
  const codeFlag = await page.evaluate(() => window.FIRST_STEPS.code);
  expect(codeFlag).toBe(true);

  // Verify no old-dialect keys leaked
  const oldKeys = await page.evaluate(() => {
    const fs = window.FIRST_STEPS;
    return ['bundle_visited','word_opened','wall_prayed','record_filed',
            'community_visited','fast_started','affiliate_visited']
      .filter(k => k in fs);
  });
  expect(oldKeys).toEqual([]);
});


/* ═══════════════════════════════════════════════════
   TEST 7: 7/7 celebration
   ═══════════════════════════════════════════════════ */
test('7/7 completion collapses card', async ({ page }) => {
  await loginAndBoot(page, {
    tourDoneAt: '2026-07-20T00:00:00Z',
    firstSteps: {
      bundle: true,
      word: true,
      wall: true,
      record: true,
      community: true,
      fast: true
      // code missing — will be 6/7
    }
  });

  await page.evaluate(() => {
    if (typeof renderDash === 'function') renderDash();
  });

  const card = page.locator('#firstStepsCard');
  await expect(card).toBeVisible();

  // Report the last step (server key 'code')
  await page.evaluate(() => reportFirstStepVisit('affiliate'));

  await page.waitForTimeout(600);

  const opacity = await page.evaluate(() => {
    const el = document.getElementById('firstStepsCard');
    return el ? getComputedStyle(el).opacity : '0';
  });
  expect(parseFloat(opacity)).toBeLessThanOrEqual(0.1);
});


/* ═══════════════════════════════════════════════════
   TEST 8: Mobile bottom-sheet mode
   ═══════════════════════════════════════════════════ */
test('Mobile renders tour card as bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await loginAndBoot(page, { tourDoneAt: null });
  await page.evaluate(() => startGuidedTour());

  const cardStyles = await page.evaluate(() => {
    const card = document.getElementById('tourCard');
    const cs = getComputedStyle(card);
    return {
      position: cs.position,
      bottom: cs.bottom
    };
  });

  expect(cardStyles.position).toBe('fixed');
  expect(cardStyles.bottom).toBe('0px');
});


/* ═══════════════════════════════════════════════════
   TEST 9: Retake tour from More section
   ═══════════════════════════════════════════════════ */
test('Retake tour button restarts tour', async ({ page }) => {
  await loginAndBoot(page, {
    tourDoneAt: '2026-07-20T00:00:00Z',
    firstSteps: { bundle: true }
  });

  await page.evaluate(() => {
    const btn = document.getElementById('navRetakeTour');
    if (btn) btn.click();
  });

  const overlay = page.locator('#tourDimOverlay');
  await expect(overlay).toHaveClass(/active/);

  const card = page.locator('#tourCard');
  await expect(card).toHaveClass(/active/);
});


/* ═══════════════════════════════════════════════════
   TEST 10: Keyboard navigation
   ═══════════════════════════════════════════════════ */
test('Keyboard navigation works', async ({ page }) => {
  await loginAndBoot(page, { tourDoneAt: null });
  await page.evaluate(() => startGuidedTour());

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);

  const title = await page.locator('.tour-card__title').textContent();
  expect(title).toBe('Home');

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);

  const titleBack = await page.locator('.tour-card__title').textContent();
  expect(titleBack).toContain('Morning Dependency');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const overlay = page.locator('#tourDimOverlay');
  await expect(overlay).not.toHaveClass(/active/);
});


/* ═══════════════════════════════════════════════════
   TEST 11: Wire shape — POST body uses { done } and { steps }
   ═══════════════════════════════════════════════════ */
test('Wire shape: POST uses done/steps, not action/first_steps/email', async ({ page }) => {
  await loginAndBoot(page, { tourDoneAt: null });

  // Intercept tour-state POST and capture the body
  const bodies = [];
  await page.route('**/tour-state', async (route) => {
    const req = route.request();
    const body = JSON.parse(req.postData() || '{}');
    bodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, tour_done_at: new Date().toISOString(), first_steps: {} })
    });
  });

  // Provide a mock session so postTourState doesn't skip
  await page.evaluate(() => {
    window.sb = {
      auth: {
        getSession: () => Promise.resolve({
          data: { session: { access_token: 'mock-jwt-token-123' } }
        })
      }
    };
  });

  // Complete the tour
  await page.evaluate(() => startGuidedTour());
  await page.evaluate(() => completeTour());
  await page.waitForTimeout(800);

  // Verify body shape
  expect(bodies.length).toBeGreaterThanOrEqual(1);
  const doneBody = bodies.find(b => b.done);
  expect(doneBody).toBeTruthy();
  expect(doneBody.done).toBe(true);

  // MUST NOT contain old-dialect keys
  bodies.forEach(b => {
    expect(b).not.toHaveProperty('action');
    expect(b).not.toHaveProperty('first_steps');
    expect(b).not.toHaveProperty('email');
  });
});


/* ═══════════════════════════════════════════════════
   TEST 12: Auth — no session → no POST
   ═══════════════════════════════════════════════════ */
test('No session token → no POST sent (anon key never used)', async ({ page }) => {
  await loginAndBoot(page, { tourDoneAt: null });

  let postSent = false;
  await page.route('**/tour-state', async (route) => {
    postSent = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });

  // sb exists but session is null → should skip POST
  await page.evaluate(() => {
    window.sb = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } })
      }
    };
  });

  await page.evaluate(() => startGuidedTour());
  await page.evaluate(() => completeTour());
  await page.waitForTimeout(800);

  expect(postSent).toBe(false);
});


/* ═══════════════════════════════════════════════════
   TEST 13: At a Glance is not in the tour or nav
   ═══════════════════════════════════════════════════ */
test('At a Glance tab hidden and removed from tour', async ({ page }) => {
  await loginAndBoot(page, { tourDoneAt: null });

  // Nav button should be hidden
  const navVisible = await page.evaluate(() => {
    const el = document.getElementById('navLeaderboard');
    return el ? getComputedStyle(el).display !== 'none' : false;
  });
  expect(navVisible).toBe(false);

  // Start tour and check no step has 'At a Glance' title
  await page.evaluate(() => startGuidedTour());

  const hasGlanceStep = await page.evaluate(() => {
    const dots = document.querySelectorAll('.tour-card__dot').length;
    let found = false;
    for (let i = 0; i < dots; i++) {
      const title = document.querySelector('.tour-card__title');
      if (title && title.textContent.includes('At a Glance')) {
        found = true;
        break;
      }
      if (typeof tourNext === 'function') tourNext();
    }
    return found;
  });
  expect(hasGlanceStep).toBe(false);
});
