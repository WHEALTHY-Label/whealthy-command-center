const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log("=== STARTING PLAYWRIGHT UI TEST FOR BIBLE 365 LIVE FEED ===");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });

  const page = await context.newPage();

  // Pipe page logs to console
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Mock Supabase Auth and Client Database calls before page load
  await page.addInitScript(() => {
    Object.defineProperty(window, 'supabase', {
      configurable: true,
      get() { return this._supabase; },
      set(val) {
        if (val && val.createClient) {
          const originalCreateClient = val.createClient;
          val.createClient = function(...args) {
            const client = originalCreateClient(...args);
            if (client) {
              if (client.auth) {
                client.auth.getSession = async () => {
                  return {
                    data: {
                      session: {
                        user: { 
                          id: '12345678-1234-1234-1234-1234567890ab',
                          email: 'whealthylabel@gmail.com' 
                        }
                      }
                    },
                    error: null
                  };
                };
                client.auth.onAuthStateChange = (cb) => {
                  cb('SIGNED_IN', {
                    user: { 
                      id: '12345678-1234-1234-1234-1234567890ab',
                      email: 'whealthylabel@gmail.com' 
                    }
                  });
                  return { data: { subscription: { unsubscribe: () => {} } } };
                };
              }
              client.from = (table) => {
                return {
                  select: () => ({
                    eq: () => ({
                      single: async () => {
                        if (table === 'bible_progress') {
                          return {
                            data: {
                              user_id: '12345678-1234-1234-1234-1234567890ab',
                              start_date: new Date().toISOString(),
                              completed_days: []
                            },
                            error: null
                          };
                        }
                        return { data: null, error: { message: 'Not found' } };
                      }
                    })
                  }),
                  upsert: async () => ({ error: null }),
                  delete: () => ({
                    eq: async () => ({ error: null })
                  })
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

  let mockBiblePosts = [
    {
      id: "bible-post-1",
      member_id: "2",
      body: "Praying for guidance in my studies today.",
      status: "live",
      display_mode: "signed",
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      author: { name: "Sarah" },
      prays_remaining_today: 3
    },
    {
      id: "bible-post-2",
      member_id: "3",
      body: "Need strength for my morning fast.",
      status: "live",
      display_mode: "anonymous",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      author: { name: "A Steward" },
      prays_remaining_today: 2 // already prayed by viewer
    }
  ];

  await page.route('**/functions/v1/wall-read', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-read request for view:", payload.view);

    if (payload.view === 'bible365') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: mockBiblePosts })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: [] })
      });
    }
  });

  let lastPostedBody = null;
  await page.route('**/functions/v1/wall-post', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-post request with body:", payload.body);
    lastPostedBody = payload.body;
    
    // Add to mock feed
    const newPost = {
      id: "bible-post-new",
      member_id: "1",
      body: payload.body,
      status: "live",
      display_mode: payload.display_mode,
      created_at: new Date().toISOString(),
      author: { name: "Jake" },
      prays_remaining_today: 3
    };
    mockBiblePosts.unshift(newPost);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(newPost)
    });
  });

  let prayedPostId = null;
  await page.route('**/functions/v1/wall-pray', async route => {
    const payload = JSON.parse(route.request().postData());
    console.log("Mocking wall-pray request for post:", payload.post_id);
    prayedPostId = payload.post_id;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pray_count: 10, prays_remaining_today: 0 })
    });
  });

  // Navigate to local server
  console.log("Navigating to http://localhost:8089/...");
  await page.goto('http://localhost:8089/', { waitUntil: 'networkidle' });

  // Wait for sidebar navigation to load
  console.log("Waiting for sidebar to load...");
  await page.waitForSelector('#navBible', { timeout: 10000 });

  // Dismiss blocking modals
  console.log("Dismissing blocking modals...");
  await page.evaluate(() => {
    if (typeof window.closeClaimModal === 'function') window.closeClaimModal();
    if (typeof window.closeCaptureSheet === 'function') window.closeCaptureSheet();
    const welcome = document.getElementById('bible_welcomeOverlay');
    if (welcome) {
      welcome.classList.remove('open');
      welcome.style.display = 'none';
      welcome.style.pointerEvents = 'none';
    }
    const capture = document.getElementById('captureSheetOverlay');
    if (capture) {
      capture.classList.remove('open');
      capture.style.display = 'none';
      capture.style.pointerEvents = 'none';
    }
    const claim = document.getElementById('claimModalOverlay');
    if (claim) {
      claim.classList.remove('open');
      claim.style.display = 'none';
      claim.style.pointerEvents = 'none';
    }
  });

  // Click 'Bible 365' nav item
  console.log("Clicking 'Bible 365' sidebar navigation item...");
  await page.click('#navBible');

  console.log("Waiting for bibleView to render...");
  await page.waitForSelector('#bibleView', { state: 'visible', timeout: 5000 });

  // Expand Community Prayer task drawer
  console.log("Expanding Community Prayer Sanctuary Task...");
  await page.click('#bible_taskCommunityCheck');
  
  // Wait for drawer to expand
  await page.waitForSelector('#bible_communityPrayerDrawer', { state: 'visible', timeout: 2000 });
  console.log("Community Prayer drawer is open!");

  // Wait for feed items to render
  console.log("Waiting for live community feed to load...");
  await page.waitForSelector('#bible_communityFeedList div', { timeout: 5000 });

  // Verify no avatars and no counts are displayed
  console.log("Checking feed items UI properties...");
  const items = page.locator('#bible_communityFeedList > div');
  const count = await items.count();
  console.log(`Found ${count} items in the community feed.`);
  if (count !== 2) {
    throw new Error(`Expected 2 items, but found ${count}`);
  }

  // Verify no avatar circles/images
  const avatarsCount = await page.locator('#bible_communityFeedList img, #bible_communityFeedList .wall-card-avatar, #bible_communityFeedList .me-card-avatar').count();
  console.log("Avatar elements found in feed:", avatarsCount);
  if (avatarsCount > 0) {
    throw new Error("Found avatar element inside the feed, failing 'no avatars' rule");
  }

  // Verify button text does not contain numbers (no counts)
  const button1Text = await page.textContent('#bible_communityFeedList div:first-child button');
  const button2Text = await page.textContent('#bible_communityFeedList div:nth-child(2) button');
  console.log("Button 1 text:", button1Text.trim());
  console.log("Button 2 text:", button2Text.trim());

  if (/\d/.test(button1Text) || /\d/.test(button2Text)) {
    throw new Error("Found numbers in button labels, failing 'no counts' rule");
  }

  if (button1Text.trim() !== "🙏 Pray" || button2Text.trim() !== "🙏 Prayed") {
    throw new Error("Button labels do not match expected '🙏 Pray' and '🙏 Prayed'");
  }

  // Click '🙏 Pray' button on first card
  console.log("Clicking '🙏 Pray' button on first card...");
  await page.click('#bible_communityFeedList div:first-child button');
  
  // Verify optimistic update (should change to Prayed and carry no count)
  await page.waitForTimeout(500); // short wait for state change
  const button1TextAfterClick = await page.textContent('#bible_communityFeedList div:first-child button');
  console.log("Button 1 text after click:", button1TextAfterClick.trim());
  if (button1TextAfterClick.trim() !== "🙏 Prayed" || /\d/.test(button1TextAfterClick)) {
    throw new Error("Button optimistic state failed or shows numbers after click");
  }

  if (prayedPostId !== "bible-post-1") {
    throw new Error("Prayed endpoint did not receive the correct postId");
  }

  // Submit a new prayer request
  console.log("Entering a new prayer request...");
  await page.fill('#bible_prayerRequestText', 'NEW PRAYER REQUEST FROM BIBLE VIEW');
  
  // Set up response waiters to prevent race conditions
  const postResponsePromise = page.waitForResponse('**/functions/v1/wall-post');
  const readResponsePromise = page.waitForResponse('**/functions/v1/wall-read');

  await page.click('#bible_communityPrayerDrawer button.btn-lime');

  console.log("Waiting for network requests to finish...");
  await postResponsePromise;
  await readResponsePromise;
  await page.waitForTimeout(500); // Wait for rendering

  const topFeedText = await page.textContent('#bible_communityFeedList div:first-child p');
  console.log("Top feed text:", topFeedText);
  if (!topFeedText.includes("NEW PRAYER REQUEST FROM BIBLE VIEW")) {
    throw new Error("Feed did not load new request correctly");
  }

  // Take screenshot
  const screenshotPath = '/Users/iiggie/.gemini/antigravity-ide/brain/966715ef-b56a-4138-b127-6a8ae2bed869/scratch/bible_feed_screenshot.png';
  console.log(`Saving screenshot to ${screenshotPath}...`);
  await page.screenshot({ path: screenshotPath });

  console.log("=== PLAYWRIGHT UI TEST COMPLETED SUCCESSFULLY ===");
  await browser.close();
})().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
