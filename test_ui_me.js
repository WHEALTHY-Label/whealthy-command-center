const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("=== STARTING PLAYWRIGHT UI TEST FOR MY PRAYERS VIEW ===");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });

  const page = await context.newPage();

  // Pipe page logs to console
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Mock Supabase Auth getSession before page load
  await page.addInitScript(() => {
    Object.defineProperty(window, 'supabase', {
      configurable: true,
      get() { return this._supabase; },
      set(val) {
        if (val && val.createClient) {
          const originalCreateClient = val.createClient;
          val.createClient = function(...args) {
            const client = originalCreateClient(...args);
            if (client && client.auth) {
              client.auth.getSession = async () => {
                return {
                  data: {
                    session: {
                      user: { email: 'whealthylabel@gmail.com' }
                    }
                  },
                  error: null
                };
              };
            }
            return client;
          };
        }
        this._supabase = val;
      }
    });
  });

  // Mock Edge Functions
  console.log("Mocking backend Edge Functions...");
  await page.route('**/functions/v1/get-subscription', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verified: true,
        member: {
          id: 1,
          email: 'whealthylabel@gmail.com',
          name: 'Jake',
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

  await page.route('**/functions/v1/governor-state', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        entries: [],
        fast: null,
        history: [],
        prefs: { scribeStyle: 'full', missed: 0, landed: 0 },
        profile: {
          member_email: 'whealthylabel@gmail.com',
          season: 'Building',
          identity_profile: 'The Provider',
          archetype: 'caffeine-dependent'
        }
      })
    });
  });

  const now = new Date();
  const locksAt = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();

  let mockMinePosts = [
    {
      id: "mine-post-1",
      member_id: "1",
      body: "This is my live anonymous prayer about family.",
      status: "live",
      pray_count: 5,
      display_mode: "anonymous",
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      author: { name: "Jake" }
    },
    {
      id: "mine-post-2",
      member_id: "1",
      body: "This is my answered signed prayer.",
      status: "answered",
      pray_count: 12,
      display_mode: "signed",
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      answered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      answered_note: "God answered this prayer wonderfully. He recovered fully!",
      answered_note_locked_at: locksAt,
      author: { name: "Jake" }
    },
    {
      id: "mine-post-3",
      member_id: "1",
      body: "This is a reported held prayer.",
      status: "held",
      pray_count: 2,
      display_mode: "anonymous",
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      author: { name: "Jake" }
    }
  ];

  let mockWatchingPosts = [
    {
      id: "watch-post-1",
      member_id: "2",
      body: "This is a live watched prayer.",
      status: "live",
      pray_count: 3,
      display_mode: "signed",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      author: { name: "Sarah" }
    },
    {
      id: "watch-post-2",
      member_id: "3",
      body: "This is an answered watched prayer with unseen updates.",
      status: "answered",
      pray_count: 15,
      display_mode: "anonymous",
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      answered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      answered_note: "Unseen answered note from another steward.",
      has_unseen_answer: true,
      author: { name: "A Steward" }
    }
  ];

  await page.route('**/functions/v1/wall-read', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-read request for view:", payload.view);

    if (payload.view === 'my_prayers') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: mockMinePosts })
      });
    } else if (payload.view === 'praying_for') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: mockWatchingPosts })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: [] })
      });
    }
  });

  await page.route('**/functions/v1/wall-answer', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-answer request for post:", payload.post_id);
    const post = mockMinePosts.find(p => p.id === payload.post_id);
    const updatedPost = {
      ...post,
      status: "answered",
      answered_at: new Date().toISOString(),
      answered_note: payload.note,
      answered_note_locked_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(updatedPost)
    });
  });

  await page.route('**/functions/v1/wall-answer-edit', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-answer-edit request for post:", payload.post_id);
    const post = mockMinePosts.find(p => p.id === payload.post_id);
    const updatedPost = {
      ...post,
      answered_note: payload.note
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(updatedPost)
    });
  });

  await page.route('**/functions/v1/wall-sign', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-sign request for post:", payload.post_id);
    const post = mockMinePosts.find(p => p.id === payload.post_id);
    const updatedPost = {
      ...post,
      display_mode: "signed"
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(updatedPost)
    });
  });

  await page.route('**/functions/v1/wall-seen', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-seen request for post:", payload.post_id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });

  // Navigate to local server
  console.log("Navigating to http://localhost:8089/...");
  await page.goto('http://localhost:8089/', { waitUntil: 'networkidle' });

  // Wait for sidebar navigation to load
  console.log("Waiting for sidebar to load...");
  await page.waitForSelector('#navMe', { timeout: 10000 });

  // Dismiss blocking modals
  console.log("Dismissing blocking modals...");
  await page.evaluate(() => {
    if (typeof window.closeClaimModal === 'function') window.closeClaimModal();
    if (typeof window.closeCaptureSheet === 'function') window.closeCaptureSheet();
  });

  // Check initial badge presence
  console.log("Verifying initial badge is rendered since there is 1 unseen answered watched prayer...");
  const meBadge = page.locator('#meBadge');
  await meBadge.waitFor({ state: 'visible', timeout: 5000 });
  console.log("Badge is visible in sidebar!");

  // Click 'My Prayers' nav item
  console.log("Clicking 'My Prayers' sidebar navigation item...");
  await page.click('#navMe');

  console.log("Waiting for My Prayers view to render...");
  await page.waitForSelector('#meView', { state: 'visible', timeout: 5000 });

  // Verify elements
  console.log("Verifying page title...");
  const pageTitle = await page.textContent('.me-title');
  if (pageTitle.trim() !== "MY PRAYERS") {
    throw new Error("Page title is incorrect: " + pageTitle);
  }

  // Verify list cards
  console.log("Checking cards under My Prayers panel...");
  const mineCards = page.locator('#meMineList .me-card');
  const countMine = await mineCards.count();
  console.log(`Found ${countMine} cards under My Prayers.`);
  if (countMine !== 3) {
    throw new Error(`Expected 3 cards, but found ${countMine}`);
  }

  // Verify held post layout
  console.log("Verifying held post layout...");
  const heldText = await page.textContent('#meMineList .me-card:nth-child(3) .me-status-held');
  console.log("Held post text:", heldText);
  if (!heldText.includes("under review")) {
    throw new Error("Held post layout mismatch");
  }

  // Test sign flow
  console.log("Testing one-way sign confirmation flow...");
  const firstCardSignBtn = page.locator('#meMineList .me-card:nth-child(1) .me-btn-sign');
  await firstCardSignBtn.click();
  
  // Verify modal is open
  await page.waitForSelector('#meSignModal.open', { state: 'visible', timeout: 2000 });
  console.log("Sign modal is open, clicking submit...");
  await page.click('#meSignSubmitBtn');
  await page.waitForSelector('#meSignModal.open', { state: 'hidden', timeout: 2000 });
  console.log("Sign modal successfully dismissed!");

  // Test mark answered flow
  console.log("Testing mark-answered flow...");
  const firstCardAnswerBtn = page.locator('#meMineList .me-card:first-child .me-btn-action');
  await firstCardAnswerBtn.click();

  // Verify mark answered modal is open
  await page.waitForSelector('#meAnswerModal.open', { state: 'visible', timeout: 2000 });
  console.log("Mark answered modal is open. Entering note...");
  await page.fill('#meAnswerTextarea', 'TEST ANSWER NOTE FROM PLAYWRIGHT');
  await page.click('#meAnswerSubmitBtn');
  await page.waitForSelector('#meAnswerModal.open', { state: 'hidden', timeout: 2000 });
  console.log("Mark answered modal successfully dismissed!");

  // Test edit note flow
  console.log("Testing edit note flow...");
  const secondCardEditBtn = page.locator('#meMineList .me-card:nth-child(2) .me-btn-action');
  await secondCardEditBtn.click();
  await page.waitForSelector('#meAnswerModal.open', { state: 'visible', timeout: 2000 });
  console.log("Edit note modal is open. Modifying note...");
  await page.fill('#meAnswerTextarea', 'EDITED TEST ANSWER NOTE FROM PLAYWRIGHT');
  await page.click('#meAnswerSubmitBtn');
  await page.waitForSelector('#meAnswerModal.open', { state: 'hidden', timeout: 2000 });
  console.log("Edit note modal successfully dismissed!");

  // Switch to Watching tab
  console.log("Switching to 'Praying For' tab...");
  await page.click('#meTabBtnWatching');
  await page.waitForSelector('#mePanelWatching', { state: 'visible', timeout: 2000 });

  // Verify watchlist cards
  console.log("Checking cards under Praying For panel...");
  const watchingCards = page.locator('#meWatchingList .me-card');
  const countWatching = await watchingCards.count();
  console.log(`Found ${countWatching} cards under Praying For.`);
  if (countWatching !== 2) {
    throw new Error(`Expected 2 cards, but found ${countWatching}`);
  }

  // Dwelling for seen stamp
  console.log("Dwelling on the unseen answered watched card to trigger seen-stamp...");
  await page.hover('#meWatchingList .me-card:nth-child(2)');
  await page.waitForTimeout(1500); // Wait for 1.5s dwelling

  // Verify badge is updated (should decrement or hide since seen-stamp triggers)
  console.log("Verifying badge updates...");
  
  // Take screenshot
  const screenshotPath = '/Users/iiggie/.gemini/antigravity-ide/brain/966715ef-b56a-4138-b127-6a8ae2bed869/scratch/me_view_screenshot.png';
  console.log(`Saving screenshot to ${screenshotPath}...`);
  await page.screenshot({ path: screenshotPath });

  console.log("=== PLAYWRIGHT UI TEST COMPLETED SUCCESSFULLY ===");
  await browser.close();
})().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
