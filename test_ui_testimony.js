const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("=== STARTING PLAYWRIGHT UI TEST FOR TESTIMONY WALL ===");

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

  const mockPosts = [
    {
      id: "test-post-1",
      member_id: "1",
      body: "This is the first mock prayer about healing and strength.",
      status: "answered",
      pray_count: 42,
      amen_count: 10,
      display_mode: "signed",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      answered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      answered_note: "God answered this prayer wonderfully. He recovered fully in 3 days!",
      author: { name: "Jake", avatar_url: null },
      has_amened: false
    },
    {
      id: "test-post-2",
      member_id: "2",
      body: "Please pray for our family's financial breakthrough and guidance.",
      status: "answered",
      pray_count: 128,
      amen_count: 34,
      display_mode: "anonymous",
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      answered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      answered_note: "We received unexpected support! Thank you all for carrying this need.",
      author: { name: "A Steward", avatar_url: null },
      has_amened: true
    }
  ];

  await page.route('**/functions/v1/wall-read', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-read request for view:", payload.view);

    if (payload.view === 'testimony_top') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: [mockPosts[1]] }) // 1 top post
      });
    } else if (payload.view === 'testimony_river') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: mockPosts })
      });
    } else if (payload.view === 'single') {
      const match = mockPosts.find(p => p.id === payload.post_id) || mockPosts[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(match)
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: [] })
      });
    }
  });

  await page.route('**/functions/v1/wall-amen', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-amen request for post:", payload.post_id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ amen_count: 11, has_amened: true })
    });
  });

  // Navigate to local server
  console.log("Navigating to page with mocked session...");
  await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });

  // Wait for sidebar navigation to load
  console.log("Waiting for sidebar to load...");
  await page.waitForSelector('#parentPrayer', { timeout: 10000 });

  // Dismiss claimModal and captureSheetOverlay if they are open
  console.log("Dismissing blocking modals...");
  await page.evaluate(() => {
    if (typeof window.closeClaimModal === 'function') window.closeClaimModal();
    if (typeof window.closeCaptureSheet === 'function') window.closeCaptureSheet();
  });

  // Click 'Testimony Wall' nav item
  console.log("Clicking 'Testimony Wall' sidebar navigation item...");
  await page.click('#parentPrayer');
  await page.click('#navTestimony');

  console.log("Waiting for Testimony Wall view to render...");
  await page.waitForSelector('#testimonyView', { state: 'visible', timeout: 5000 });

  // Verify headers and sections
  console.log("Verifying sections...");
  const topHeader = await page.textContent('#tst-top-section h2');
  const riverHeader = await page.textContent('.tst-river-section h2');
  console.log("Top section header:", topHeader);
  console.log("River section header:", riverHeader);

  if (topHeader !== "MOST CARRIED" || riverHeader !== "EVERY ANSWER") {
    throw new Error("Section headers do not match specification");
  }

  // Verify cards rendering
  console.log("Verifying cards content...");
  await page.waitForSelector('#tst-top-grid .tst-card', { state: 'attached', timeout: 5000 });
  await page.waitForSelector('#tst-river-list .tst-card', { state: 'attached', timeout: 5000 });
  const topCardsCount = await page.locator('#tst-top-grid .tst-card').count();
  const riverCardsCount = await page.locator('#tst-river-list .tst-card').count();
  console.log(`Found ${topCardsCount} top cards and ${riverCardsCount} river cards.`);

  if (topCardsCount !== 1 || riverCardsCount !== 2) {
    throw new Error("Mock card counts do not match expected DOM elements");
  }

  // Verify dual-block card layout content
  const firstAsked = await page.textContent('#tst-river-list .tst-card:first-child .tst-body-asked');
  const firstAnswered = await page.textContent('#tst-river-list .tst-card:first-child .tst-body-answered');
  const elapsedText = await page.textContent('#tst-river-list .tst-card:first-child .tst-elapsed');
  console.log("Card Asked Body:", firstAsked);
  console.log("Card Answered Note:", firstAnswered);
  console.log("Elapsed Time Text:", elapsedText);

  if (!firstAsked.includes("first mock prayer") || !firstAnswered.includes("recovered fully")) {
    throw new Error("Card body content is incorrect");
  }

  // Click Amen on first card (which is not amened yet)
  console.log("Testing optimistic Amen button tap...");
  const amenBtn = page.locator('#tst-river-list .tst-card:first-child .tst-btn-amen');
  await expectAmenState(amenBtn, false);
  await amenBtn.click();
  await expectAmenState(amenBtn, true);

  // Take a screenshot of the Testimony Wall page
  const screenshotPath = '/Users/iiggie/.gemini/antigravity-ide/brain/966715ef-b56a-4138-b127-6a8ae2bed869/scratch/testimony_wall_screenshot.png';
  console.log(`Saving screenshot to ${screenshotPath}...`);
  await page.screenshot({ path: screenshotPath });

  // Test Deep Link Pinning Flow
  console.log("Testing deep link parameter landing...");
  await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html?view=testimony&post=test-post-1', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    if (typeof window.closeClaimModal === 'function') window.closeClaimModal();
    if (typeof window.closeCaptureSheet === 'function') window.closeCaptureSheet();
  });

  console.log("Waiting for pinned testimony section...");
  await page.waitForSelector('#tst-pinned', { state: 'visible', timeout: 5000 });
  const pinnedText = await page.textContent('#tst-pinned-card-slot .tst-body-asked');
  console.log("Pinned card asked body:", pinnedText);

  if (!pinnedText.includes("first mock prayer")) {
    throw new Error("Deep linked post failed to pin correctly");
  }

  const pinnedScreenshotPath = '/Users/iiggie/.gemini/antigravity-ide/brain/966715ef-b56a-4138-b127-6a8ae2bed869/scratch/testimony_wall_pinned_screenshot.png';
  console.log(`Saving pinned screenshot to ${pinnedScreenshotPath}...`);
  await page.screenshot({ path: pinnedScreenshotPath });

  console.log("=== PLAYWRIGHT UI TEST COMPLETED SUCCESSFULLY ===");
  await browser.close();
})().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

async function expectAmenState(locator, expectedActive) {
  const classes = await locator.getAttribute('class');
  const isActive = classes.includes('active');
  const text = await locator.textContent();
  
  console.log(`Amen button status - Active: ${isActive}, Text: "${text.trim()}"`);
  if (isActive !== expectedActive) {
    throw new Error(`Expected active state to be ${expectedActive}, but got ${isActive}`);
  }
}
