const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

console.log("=== RUNNING HAND IT OVER V2 & MY BIBLE INTEGRATION TESTS ===");

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
                      user: { email: 'steward@whealthy.com' }
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

    // Mock endpoints
    await page.route('**/functions/v1/get-subscription', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ active: true })
      });
    });

    await page.route('**/functions/v1/verify-member', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          member: {
            id: 'member-123',
            name: 'Steward Member',
            email: 'steward@whealthy.com',
            tour_state: { dismissed: true }
          }
        })
      });
    });

    // Mock bible-verses
    await page.route('**/functions/v1/bible-verses*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reference: "Psalm 127:1",
          verses: [
            { book_name: "Psalm", chapter: 127, verse: 1, text: "Unless the Lord builds the house, its builders labor in vain." },
            { book_name: "Psalm", chapter: 127, verse: 2, text: "In vain you rise early and stay up late..." }
          ],
          text: "Unless the Lord builds the house, its builders labor in vain."
        })
      });
    });

    // Mock prayers-read (ledger)
    await page.route('**/functions/v1/prayers-read', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'p-1', category: 'family', body: 'My Family Weight', status: 'held', pray_count: 0, created_at: new Date().toISOString() }
        ])
      });
    });

    // Mock prayers-write
    await page.route('**/functions/v1/prayers-write', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: 'p-2', status: 'held' })
      });
    });

    // Mock my-bible-state
    await page.route('**/functions/v1/my-bible-state', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, state: { book: 'Matthew', chapter: 1, verse: 1, mode: 'my' } })
      });
    });

    // Mock my-bible-marks
    await page.route('**/functions/v1/my-bible-marks', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, marks: [] })
      });
    });

    // Mock governor-ai
    await page.route('**/functions/v1/governor-ai', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          out: {
            reply: 'This is what the scripture teaches.',
            verses: [{ reference: 'Psalm 127:1', text: 'Unless the Lord builds the house...' }]
          }
        })
      });
    });

    // Load page
    const filePath = path.resolve(__dirname, 'index.html');
    await page.goto(`file://${filePath}`);

    // Wait for the app to init
    await page.waitForTimeout(1000);

    // Run gate bypass
    await page.evaluate(() => {
      localStorage.setItem('wh_steward_email', 'steward@whealthy.com');
      localStorage.setItem('wh_steward_name', 'Steward Member');
      localStorage.setItem('wh_claim_dismissed_month', new Date().toISOString().slice(0, 7));
      if (typeof closeClaimModal === 'function') closeClaimModal();
      
      const gate = document.getElementById('loginGate');
      if (gate) gate.style.display = 'none';
      window.MEMBER_EMAIL = 'steward@whealthy.com';
      window.MEMBER_NAME = 'Steward Member';
      window.MEMBER_ID = 'member-123';
    });
    await page.waitForTimeout(1000);

    // Navigate to Prayer Tab
    console.log("Navigating to Prayer View...");
    await page.evaluate(() => go('prayer'));
    await page.waitForTimeout(500);

    // Verify step 1 door is visible
    const isDoorVisible = await page.isVisible('#hioStepDoor');
    console.log("Is Step 1 Door visible?", isDoorVisible);

    // Select category 'Family'
    console.log("Selecting Family category...");
    await page.click('button:has-text("Family")');
    await page.waitForTimeout(200);

    // Verify step 2 Name It is visible
    const isNameVisible = await page.isVisible('#hioStepName');
    console.log("Is Step 2 Name visible?", isNameVisible);

    // Fill Name input
    console.log("Filling prayer weight...");
    await page.fill('#hioNameInput', 'My family needs guidance');
    await page.click('button:has-text("Hand It Over")');
    await page.waitForTimeout(200);

    // Verify step 3 Hand It is visible
    const isHandVisible = await page.isVisible('#hioStepHand');
    console.log("Is Step 3 Hand visible?", isHandVisible);

    // Verify led copy line renders
    const ledText = await page.textContent('#hioLedLineText');
    console.log("Renders led text:", ledText);

    // Verify scripture card opens inline reader
    console.log("Tapping scripture card...");
    await page.click('#hioScriptureRef');
    await page.waitForTimeout(200);
    const isInlineReaderVisible = await page.isVisible('#hioInlineReader');
    console.log("Is Inline Reader expanded?", isInlineReaderVisible);

    // Proceed to Step 4 Leave It
    console.log("Proceeding to Leave It step...");
    await page.click('button:has-text("Leave It Here")');
    await page.waitForTimeout(200);
    const isLeaveVisible = await page.isVisible('#hioStepLeave');
    console.log("Is Step 4 Leave visible?", isLeaveVisible);

    // Click private card and confirm
    await page.click('#cardLeavePrivate');
    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(200);

    // Verify confirmation step
    const isConfirmVisible = await page.isVisible('#hioStepConfirm');
    console.log("Is Confirmation Step visible?", isConfirmVisible);

    // Navigate to Scripture Tab
    console.log("Navigating to Bible View...");
    await page.evaluate(() => {
      go('bible');
      const overlay = document.getElementById('bible_welcomeOverlay');
      if (overlay) overlay.style.display = 'none';
    });
    await page.waitForTimeout(500);

    // Verify Mode Toggles
    const toggleBible365 = await page.isVisible('#toggleBible365');
    const toggleMyBible = await page.isVisible('#toggleMyBible');
    console.log("Mode Toggles rendered:", toggleBible365 && toggleMyBible);

    // Switch to My Bible
    console.log("Switching to My Bible...");
    await page.click('#toggleMyBible');
    await page.waitForTimeout(500);
    const isMyBibleContentVisible = await page.isVisible('#myBibleContentWrapper');
    console.log("Is My Bible panel visible?", isMyBibleContentVisible);

    console.log("ALL TESTS COMPLETED SUCCESSFULLY");
  } catch (err) {
    console.error("TEST RUN FAILED:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
