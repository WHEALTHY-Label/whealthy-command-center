const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

console.log("=== STARTING PLAYWRIGHT INTEGRATION TEST FOR PAGE 6 ===");

// 1. Start lightweight static HTTP server on port 8089
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not Found');
    } else {
      let contentType = 'text/html';
      if (filePath.endsWith('.js')) contentType = 'application/javascript';
      if (filePath.endsWith('.css')) contentType = 'text/css';
      if (filePath.endsWith('.png')) contentType = 'image/png';
      res.setHeader('Content-Type', contentType);
      res.end(data);
    }
  });
});

server.listen(8089, async () => {
  console.log("Static server running on http://localhost:8089");
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 }
    });

    const page = await context.newPage();

    // Pipe page logs to console for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // Mock Supabase Auth getSession
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

    // Mock get-subscription Edge Function
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

    // We will dynamically control the responses for wall-ai-context and governor-ai
    let mockLivePostCount = 3;
    let mockTopPostPrayCount = 30; // heavy community carries
    let mockPraysLast24h = 60;
    
    let mockWatchlist = [
      { id: "watch-1", status: "answered", days_since_prayed: 2, has_unseen_answer: true, my_pray_count: 5, days_elapsed: 10, pray_count: 25 },
      { id: "watch-2", status: "live", days_since_prayed: 1, has_unseen_answer: false, my_pray_count: 2, days_elapsed: 2, pray_count: 4 },
      { id: "watch-3", status: "live", days_since_prayed: 4, has_unseen_answer: false, my_pray_count: 1, days_elapsed: 1, pray_count: 1 },
      { id: "watch-4", status: "live", days_since_prayed: 5, has_unseen_answer: false, my_pray_count: 1, days_elapsed: 1, pray_count: 2 },
      { id: "watch-5", status: "live", days_since_prayed: 6, has_unseen_answer: false, my_pray_count: 1, days_elapsed: 1, pray_count: 3 }
    ];

    await page.route('**/functions/v1/wall-ai-context', async route => {
      const payload = JSON.parse(route.request().postData());
      console.log(`Mocking wall-ai-context for scope: ${payload.scope}`);
      if (payload.scope === 'community') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            scope: 'community',
            live_post_count: mockLivePostCount,
            prays_last_24h: mockPraysLast24h,
            answered_last_7d: 2,
            top_post_pray_count: mockTopPostPrayCount
          })
        });
      } else if (payload.scope === 'own') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            scope: 'own',
            posts: [], // no active live post by user
            watchlist: mockWatchlist
          })
        });
      }
    });

    await page.route('**/functions/v1/governor-ai', async route => {
      const payload = JSON.parse(route.request().postData());
      console.log(`Mocking governor-ai for task: ${payload.task}`);
      
      if (payload.task === 'synthesis') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            out: {
              dashTitle: "Good morning, Jake",
              dashSubtitle: "Today carries new focus.",
              dailyDirective: "Personalized Daily Focus: Take 2 minutes to carry someone else's burden on the wall today.",
              bibleTitle: "Bible 365",
              bibleSubtitle: "Keep the streak.",
              fastTitle: "The Fast",
              fastSubtitle: "Governed.",
              recordTitle: "The Record",
              recordSubtitle: "Words kept.",
              leaderboardTitle: "At a Glance",
              leaderboardSubtitle: "Streaks active."
            }
          })
        });
      } else if (payload.task === 'notification_voice') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            out: { text: "He answered the prayer you carried ten days." }
          })
        });
      } else if (payload.task === 'watchlist_synthesis') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            out: { text: "You have carried five burdens, and one has been answered." }
          })
        });
      } else if (payload.task === 'record_wall_nudge') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            out: { showNudge: true, text: "This keeps coming up. You do not have to carry it alone." }
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, out: {} })
        });
      }
    });

    // Mock governor-state Edge Function
    // We populate S.entries with 4 entries spanning 20 days to meet the 14-day & 3+ entries Record nudge gates
    const entries = [
      { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], text: "Burden aboutDanny's situation and Sarah.", tone: "heavy", scribe: "Kept." },
      { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], text: "Sarah and Danny need clarity.", tone: "heavy", scribe: "Kept." },
      { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], text: "Still carrying Danny's situation.", tone: "heavy", scribe: "Kept." },
      { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], text: "Spoke about Danny's recovery again.", tone: "heavy", scribe: "Kept." }
    ];

    await page.route('**/functions/v1/governor-state', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          entries: entries,
          fast: null,
          history: [],
          prefs: { scribeStyle: 'full', missed: 0, landed: 0, last_scribe_lines: [] },
          profile: {
            member_email: 'whealthylabel@gmail.com',
            season: 'Building',
            identity_profile: 'The Provider',
            archetype: 'caffeine-dependent'
          }
        })
      });
    });

    // Also mock wall-read for Praying For (watchlist) tab rendering
    let mockWallReadWatching = [
      {
        id: "watch-1",
        member_id: "2",
        body: "This is the answered watched prayer text.",
        status: "answered",
        pray_count: 25,
        display_mode: "anonymous",
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        answered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        answered_note: "Verification check answered note.",
        has_unseen_answer: true,
        author: { name: "Sarah" }
      }
    ];

    await page.route('**/functions/v1/wall-read', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ posts: mockWallReadWatching })
      });
    });

    // Start navigating
    console.log("Navigating to http://localhost:8089/...");
    await page.goto('http://localhost:8089/', { waitUntil: 'networkidle' });

    // Dismiss blocking modals
    await page.evaluate(() => {
      window.openClaimModal = () => {};
      window.openCaptureSheet = () => {};
      const cm = document.getElementById('claimModal');
      if (cm) {
        cm.style.display = 'none';
        cm.classList.remove('open');
      }
      const cs = document.getElementById('captureSheet');
      if (cs) {
        cs.style.display = 'none';
        cs.classList.remove('open');
      }
    });

    // --- TEST 1: Dashboard Nudge Card Visibility ---
    console.log("Verifying Nudge Card visibility on dashboard...");
    const nudgeCard = page.locator('#dashWallNudgeCard');
    await nudgeCard.waitFor({ state: 'visible', timeout: 5000 });
    const nudgeText = await nudgeCard.textContent();
    console.log("Nudge Card text content:", nudgeText.trim());
    if (!nudgeText.includes("Stewards are carrying things right now.")) {
      throw new Error("Nudge card text mismatch!");
    }
    console.log("TEST 1 PASSED: Nudge Card displayed successfully.");

    // --- TEST 2: Answered Notification Voice ---
    console.log("Navigating to My Prayers page ('me' tab)...");
    await page.click('#parentPrayer');
    await page.click('#navMe');
    await page.waitForSelector('#mePanelMine', { state: 'visible', timeout: 5000 });
    
    console.log("Switching to 'Praying For' tab...");
    await page.click('#meTabBtnWatching');
    await page.waitForSelector('#mePanelWatching', { state: 'visible', timeout: 5000 });

    console.log("Verifying notification voice line renders above the unseen answered watched card...");
    const voiceLine = page.locator('#voice-line-watch-1');
    await voiceLine.waitFor({ state: 'visible', timeout: 5000 });
    const voiceText = await voiceLine.textContent();
    console.log("Voice line text:", voiceText.trim());
    if (voiceText.trim() !== "He answered the prayer you carried ten days.") {
      throw new Error("Voice line text mismatch!");
    }
    console.log("TEST 2 PASSED: Answered Notification Voice rendered successfully.");

    // --- TEST 3: Watchlist Synthesis ---
    console.log("Verifying Watchlist Synthesis renders at the top of the panel...");
    const synthContainer = page.locator('#meWatchingSynthesis');
    await synthContainer.waitFor({ state: 'visible', timeout: 5000 });
    const synthText = await synthContainer.textContent();
    console.log("Synthesis reflection text:", synthText.trim());
    if (synthText.trim() !== "You have carried five burdens, and one has been answered.") {
      throw new Error("Watchlist synthesis text mismatch!");
    }
    console.log("TEST 3 PASSED: Watchlist Synthesis reflection rendered successfully.");

    // --- TEST 4: Record Nudge ---
    console.log("Navigating to The Record page...");
    // Open the sidebar if needed, or click direct nav
    await page.click('#navRecord');
    await page.waitForSelector('#recordArea', { state: 'visible', timeout: 5000 });

    console.log("Verifying Record-to-Wall nudge card renders above Tonight's Entry...");
    const recordNudge = page.locator('#recordWallNudge');
    await recordNudge.waitFor({ state: 'visible', timeout: 5000 });
    const recordNudgeText = await recordNudge.textContent();
    console.log("Record Nudge text:", recordNudgeText.trim());
    if (!recordNudgeText.includes("This keeps coming up. You do not have to carry it alone.")) {
      throw new Error("Record nudge text mismatch!");
    }
    console.log("TEST 4 PASSED: Record-to-Wall Nudge rendered successfully.");

    console.log("=== ALL PAGE 6 INTEGRATION TESTS PASSED ===");
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    server.close(() => {
      console.log("Static server shut down.");
      process.exit(0);
    });
  }
});
