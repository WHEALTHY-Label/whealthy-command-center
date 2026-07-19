const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

console.log("=== RUNNING ADMIN SURFACE & SECURITY GATE INTEGRATION TESTS ===");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    // 1. Mock Supabase Auth getSession before page loads
    await page.addInitScript(() => {
      let supabaseVal;
      Object.defineProperty(window, 'supabase', {
        get() { return supabaseVal; },
        set(val) {
          supabaseVal = val;
          if (supabaseVal && typeof supabaseVal.createClient === 'function') {
            const orig = supabaseVal.createClient;
            supabaseVal.createClient = (url, key) => {
              const client = orig(url, key);
              client.auth.getSession = async () => {
                return {
                  data: {
                    session: {
                      access_token: 'mock-jwt-token-12345',
                      user: { email: 'ignacio@thebizcofirm.com' }
                    }
                  },
                  error: null
                };
              };
              return client;
            };
          }
        },
        configurable: true
      });
    });

    await page.setViewportSize({ width: 1200, height: 800 });

    // Mock get-subscription (member status)
    await page.route('**/functions/v1/get-subscription', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: true,
          member: {
            id: 1,
            email: 'ignacio@thebizcofirm.com',
            name: 'Ignacio',
            last_name: '',
            member_status: 'member'
          },
          recommendation: {
            archetype: 'caffeine-dependent',
            archetype_name: 'The Provider',
            bundle_key: 'genius-guice',
            bundle_name: 'Genius Guice'
          },
          subscription: null,
          orders: []
        })
      });
    });

    // Mock verify-member (admin role)
    await page.route('**/functions/v1/verify-member', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: true,
          admin_role: 'master'
        })
      });
    });

    // Mock cohort-create
    let cohortCreatedPayload = null;
    await page.route('**/functions/v1/cohort-create', async route => {
      cohortCreatedPayload = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, cohort_id: 'mock-cohort-777' })
      });
    });

    console.log("Navigating to index.html...");
    await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Initial setting of credentials & dismiss modal
    await page.evaluate(() => {
      localStorage.setItem('wh_steward_email', 'ignacio@thebizcofirm.com');
      localStorage.setItem('wh_steward_name', 'Ignacio');
      localStorage.setItem('wh_claim_dismissed_month', new Date().toISOString().slice(0, 7));
      if (typeof closeClaimModal === 'function') closeClaimModal();
    });

    // Force run gate to trigger verify-member check
    console.log("Triggering waRunGate for master admin...");
    await page.evaluate(async () => {
      await waRunGate('ignacio@thebizcofirm.com');
    });
    await page.waitForTimeout(1000);

    // Verify Admin button is visible in sidebar
    console.log("Verifying Admin sidebar navigation tab is visible...");
    const adminBtn = page.locator('#navAdmin');
    await adminBtn.waitFor({ state: 'visible', timeout: 5000 });
    const isVisible = await adminBtn.isVisible();
    if (!isVisible) throw new Error("Admin sidebar button is not visible for master role.");
    console.log("✅ Verified: Admin sidebar nav button is visible.");

    // Click Admin button
    console.log("Navigating to Admin view...");
    await adminBtn.click();
    await page.waitForSelector('#adminView', { state: 'visible', timeout: 5000 });
    console.log("✅ Verified: Admin view container is visible.");

    // Fill in Create Cohort form
    console.log("Filling Create Cohort form...");
    await page.fill('#adminCohortName', 'Fall Stewards 2026');
    await page.fill('#adminCohortStart', '2026-09-01');
    await page.fill('#adminCohortEnd', '2026-11-30');
    await page.click('button:has-text("Create Cohort")');

    // Wait for success message
    await page.waitForSelector('#adminCohortMessage:has-text("Successfully created cohort!")', { timeout: 10000 });
    console.log("✅ Verified: Create Cohort success message shown.");

    // Verify payload sent to cohort-create
    if (!cohortCreatedPayload) throw new Error("cohort-create request was not captured.");
    if (cohortCreatedPayload.email !== 'ignacio@thebizcofirm.com') {
      throw new Error("cohort-create request email incorrect: " + cohortCreatedPayload.email);
    }
    if (cohortCreatedPayload.name !== 'Fall Stewards 2026') {
      throw new Error("cohort-create request name incorrect: " + cohortCreatedPayload.name);
    }
    console.log("✅ Verified: cohort-create API payload is correct.");

    // Test a regular non-admin member
    console.log("Testing regular member non-admin view visibility...");
    await page.route('**/functions/v1/verify-member', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: true,
          admin_role: null
        })
      });
    });

    await page.evaluate(async () => {
      await waRunGate('qa-steward-1@gmail.com');
    });
    await page.waitForTimeout(1000);

    const isVisibleForRegular = await page.locator('#navAdmin').isVisible();
    if (isVisibleForRegular) throw new Error("Admin button is visible for a non-admin member.");
    console.log("✅ Verified: Admin sidebar nav button is hidden for regular members.");

    // 2. Load whealthy-admin-analytics.html and verify headers
    console.log("Loading whealthy-admin-analytics.html...");
    let statsRequestHeaders = null;
    let statsRequestBody = null;
    await page.route('**/functions/v1/admin-stats', async route => {
      statsRequestHeaders = route.request().headers();
      statsRequestBody = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, summary: {} })
      });
    });

    await page.goto('http://localhost:12345/whealthy-command-center-repo/whealthy-admin-analytics.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Call getData via page evaluate to trigger fetch
    console.log("Triggering getData in admin analytics page...");
    await page.evaluate(async () => {
      localStorage.setItem('wh_admin_key', 'admin1234');
      await getData('7d');
    });
    await page.waitForTimeout(1000);

    if (!statsRequestHeaders) throw new Error("admin-stats request was not captured.");
    console.log("Captured admin-stats headers:", JSON.stringify(statsRequestHeaders));
    console.log("Captured admin-stats body:", JSON.stringify(statsRequestBody));

    if (statsRequestHeaders['x-admin-email'] !== 'ignacio@thebizcofirm.com') {
      throw new Error("x-admin-email header incorrect: " + statsRequestHeaders['x-admin-email']);
    }
    if (statsRequestHeaders['authorization'] !== 'Bearer mock-jwt-token-12345') {
      throw new Error("Authorization header incorrect: " + statsRequestHeaders['authorization']);
    }
    if (statsRequestBody.email !== 'ignacio@thebizcofirm.com') {
      throw new Error("Request body email incorrect: " + statsRequestBody.email);
    }
    console.log("✅ Verified: Admin analytics page correctly sends session email and token.");

    console.log("=== ALL ADMIN SURFACE & SECURITY TESTS PASSED ===");
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error("Test failed:", e.message);
    await browser.close();
    process.exit(1);
  }
})();
