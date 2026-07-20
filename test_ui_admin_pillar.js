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
          admin_role: 'master',
          tour_done_at: '2026-07-20T00:00:00Z'
        })
      });
    });

    // Mock cohort-create
    let cohortCreatedPayload = null;
    let cohortCreatedHeaders = null;
    await page.route('**/functions/v1/cohort-create', async route => {
      cohortCreatedPayload = JSON.parse(route.request().postData());
      cohortCreatedHeaders = route.request().headers();
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
    if (cohortCreatedHeaders['authorization'] !== 'Bearer mock-jwt-token-12345') {
      throw new Error("cohort-create Authorization header incorrect: " + cohortCreatedHeaders['authorization']);
    }
    console.log("✅ Verified: cohort-create API payload and Authorization header are correct.");

    // Test a regular non-admin member
    console.log("Testing regular member non-admin view visibility...");
    await page.route('**/functions/v1/verify-member', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: true,
          admin_role: null,
          tour_done_at: '2026-07-20T00:00:00Z'
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
        body: JSON.stringify({
          success: true,
          members: { free: 18, paid: 40, purchasers: 20, conv: 0, dFree: 0, dPaid: 0, dPurchasers: 0, churned: 0, nurture: { queued: 0, sent: 0, joined: 0 } },
          funnel: { stages: [] },
          fasts: { started: 0, completed: 0, completionRate: 0, types: [], active: 0, endedEarly: 0, avgPct: 0, adherence: 0, avgDuration: 0 },
          fastsExtra: { dropoff: [], weakRules: [], people: { started: 0, completed: 0, endedEarly: 0, active: 0, pct: 0 }, structureOnlyPct: 0 },
          bundles: { suggested: [], purchased: [], matchRate: 0, top: { mark: '', name: '', rate: 0, purchased: 0, suggested: 0 } },
          bundleOps: { claimRate: 0, pending: 0, confirmed: 0, shipped: 0, skipped: 0, subs: { active: 0, paused: 0, cancelled: 0, autoPct: 0 }, tryToMember: 0 },
          memberHealth: { mrr: 0, activeUsers: 0, stickiness: 0, churn: 0, churned: 0, nurture: { queued: 0, sent: 0, joined: 0 } },
          engagement: { completedFasts: 0, prayerAnswers: 0, journalEntries: 0, comfort: [], journalers: 0, leaderboard: [], entriesPerMember: 0, avgStreak: 0, scriptureEngagedPct: 0, avgInteractions: 0, scribe: { landedRate: 0, briefPct: 0 }, dailyLogs: { filed: 0, avgEnergy: 0, avgPresence: 0, powderPct: 0, skipPct: 0 } },
          demo: { age: [], job: [], hours: [], consumption: [], sex: [['Men', 0], ['Women', 0]] },
          tryOrders: [],
          affiliates: { clicks: 0, signups: 0, sales: 0, top: [], registered: 0, active: 0, referred: 0, tryRefs: 0 },
          quiz: { archetypes: [], seasons: [], pageViews: 0, starts: 0, completions: 0, dropoffs: 0, ctaClicks: 0 },
          logs: [],
          stewardLog: [],
          record: { entries: 0, heavy: 1, win: 1, mixed: 1, burned: 0 },
          recordExtra: { scribePct: 0, resurfaced: 0 },
          growth: { labels: [] },
          trends: { fastsStarted: [], fastsCompleted: [], orders: [], logsFiled: [], powderDays: [], entriesFiled: [], burned: [], durations: [] }
        })
      });
    });

    await page.goto('http://localhost:12345/whealthy-command-center-repo/whealthy-admin-analytics.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Call getData via page evaluate to trigger fetch
    console.log("Triggering getData in admin analytics page...");
    await page.evaluate(async () => {
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
    if ('admin_key' in statsRequestBody) {
      throw new Error("Request body contains retired admin_key parameter.");
    }
    console.log("✅ Verified: Admin analytics page correctly sends session email and token without prompt/key.");

    console.log("=== ALL ADMIN SURFACE & SECURITY TESTS PASSED ===");
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error("Test failed:", e.message);
    await browser.close();
    process.exit(1);
  }
})();
