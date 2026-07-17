const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

console.log("=== RUNNING PRAYER SURFACE (PAGE 2) INTEGRATION TESTS ===");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Forward page console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    // 1. Mock Supabase session before loading page
    await page.addInitScript(() => {
      let supabaseVal;
      Object.defineProperty(window, 'supabase', {
        get() {
          return supabaseVal;
        },
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
                      user: {
                        email: 'whealthylabel@gmail.com'
                      }
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

    // Set viewport for responsive check
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X/11 dimensions
    
    // 2. Go to page
    console.log("Navigating to page with mocked session...");
    await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Set localStorage credentials and dismiss modal
    await page.evaluate(() => {
      localStorage.setItem('wh_steward_email', 'whealthylabel@gmail.com');
      localStorage.setItem('wh_steward_name', 'Steward');
      localStorage.setItem('wh_claim_dismissed_month', new Date().toISOString().slice(0, 7));
      if (typeof closeClaimModal === 'function') {
        closeClaimModal();
      }
    });
    
    // Check if dashContent is visible
    const dashVisible = await page.evaluate(() => {
      const gate = document.getElementById('loginGate');
      return !gate || gate.classList.contains('hidden') || gate.style.display === 'none';
    });
    if (!dashVisible) {
      await page.screenshot({ path: 'login_error.png' });
      throw new Error("Dashboard failed to load or login gate is still visible.");
    }
    console.log("✅ Session active on dashboard.");

    // 3. Navigate to Prayer View programmatically
    console.log("Navigating to Prayer View...");
    await page.evaluate(() => go('prayer'));
    await page.waitForTimeout(3000);

    const prayerVisible = await page.evaluate(() => document.getElementById('prayerView').style.display === 'block');
    if (!prayerVisible) {
      throw new Error("Prayer View failed to render or display.");
    }
    console.log("✅ Prayer View is visible.");

    // 4. Verify all three tabs are visible
    const tabsExist = await page.evaluate(() => {
      const morning = document.getElementById('prTabMorning');
      const midday = document.getElementById('prTabMidday');
      const evening = document.getElementById('prTabEvening');
      return !!(morning && midday && evening);
    });
    if (!tabsExist) {
      throw new Error("Morning, Midday, or Evening tabs are missing.");
    }
    console.log("✅ Pass tabs exist.");

    // 5. Test Morning Pass flow
    const morningPassWrites = [];
    await page.route('**/functions/v1/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const url = request.url();
        let postData = {};
        try {
          postData = JSON.parse(request.postData() || '{}');
        } catch (e) {}
        if (url.includes('prayers-write') || (url.includes('prayer-state') && (postData.action === 'advance' || postData.action === 'jump'))) {
          morningPassWrites.push({ url, postData });
        }
      }
      await route.continue();
    });

    console.log("Testing Morning Pass step-by-step...");
    await page.click('#prTabMorning');
    await page.waitForTimeout(300);

    // Verify Movement 1
    let activeTitle = await page.textContent('.pr-title');
    if (!activeTitle.includes("Our Father in heaven")) {
      throw new Error("Morning pass did not start on Movement 1. Active: " + activeTitle);
    }
    await page.fill('#prInput', 'Father God');
    await page.click('button[onclick="PRAYER.nextMorningStep()"]');

    // Movement 2
    activeTitle = await page.textContent('.pr-title');
    if (!activeTitle.includes("Hallowed be your name")) {
      throw new Error("Movement 2 failed to load. Active: " + activeTitle);
    }
    await page.fill('#prInput', 'You are holy');
    await page.click('button[onclick="PRAYER.nextMorningStep()"]');

    // Movement 3
    activeTitle = await page.textContent('.pr-title');
    if (!activeTitle.includes("Your kingdom come")) {
      throw new Error("Movement 3 failed to load. Active: " + activeTitle);
    }
    await page.fill('#prInput', 'I surrender my decisions today.');
    await page.click('button[onclick="PRAYER.nextMorningStep()"]');

    // Movement 4 (Daily bread + surfaced list)
    activeTitle = await page.textContent('.pr-title');
    if (!activeTitle.includes("Give us this day")) {
      throw new Error("Movement 4 failed to load. Active: " + activeTitle);
    }
    await page.fill('#prInput', 'Daily food');
    
    // Check surfaced list exists
    const surfacedListText = await page.textContent('#prDailySurfaced');
    console.log("Surfaced list status:", surfacedListText);
    
    // Test Back button
    await page.click('button[onclick="PRAYER.prevMorningStep()"]');
    await page.waitForTimeout(300);
    activeTitle = await page.textContent('.pr-title');
    if (!activeTitle.includes("Your kingdom come")) {
      throw new Error("Back button failed to navigate back to Movement 3.");
    }
    // Return to Movement 4
    await page.click('button[onclick="PRAYER.nextMorningStep()"]');

    // Move to Movement 5
    await page.click('button[onclick="PRAYER.nextMorningStep()"]');
    activeTitle = await page.textContent('.pr-title');
    if (!activeTitle.includes("Forgive us our debts")) {
      throw new Error("Movement 5 failed to load. Active: " + activeTitle);
    }
    
    // Verify both prompts on same screen
    const prompt1 = await page.isVisible('#prM5a');
    const prompt2 = await page.isVisible('#prM5b');
    if (!prompt1 || !prompt2) {
      throw new Error("Movement 5 does not render both prompts on the same screen.");
    }
    await page.fill('#prM5a', 'My impatience');
    await page.fill('#prM5b', 'No one');
    await page.click('button[onclick="PRAYER.nextMorningStep()"]');

    // Movement 6
    activeTitle = await page.textContent('.pr-title');
    if (!activeTitle.includes("Lead us not into temptation")) {
      throw new Error("Movement 6 failed to load. Active: " + activeTitle);
    }
    await page.fill('#prInput', 'Laziness');
    
    // Click Finish (should navigate back to dashboard)
    await page.click('button[onclick="PRAYER.nextMorningStep()"]');
    await page.waitForTimeout(500);

    const dashAfterFinish = await page.evaluate(() => document.getElementById('dashView').style.display === 'block');
    if (!dashAfterFinish) {
      throw new Error("Finish button failed to transition back to dashboard.");
    }
    console.log("✅ Morning Pass completed successfully.");

    if (morningPassWrites.length > 0) {
      throw new Error("Violation of 'stores nothing' rule: Morning Pass attempted to write to database! Writes: " + JSON.stringify(morningPassWrites));
    }
    console.log("✅ Verified: Morning Pass (Movements 1-6) wrote nothing to the database (stores nothing).");

    // 6. Test Midday Pass and Override Rotation
    console.log("Testing Midday Pass...");
    await page.evaluate(() => go('prayer'));
    await page.waitForTimeout(500);
    await page.click('#prTabMidday');
    await page.waitForTimeout(1000); // give it 1s to fetch from DB

    // Verify it is on some movement
    const middayTitle = await page.textContent('.pr-title');
    console.log("Active Midday movement:", middayTitle);

    // Click override button M3
    console.log("Clicking override button M3...");
    await page.click('.pr-rotation-btn:has-text("M3")');
    await page.waitForTimeout(2000); // give 2s for fetch to resolve
    
    const overriddenTitle = await page.textContent('.pr-title');
    if (!overriddenTitle.includes("Your kingdom come")) {
      throw new Error("Override rotation M3 failed to switch active movement. Title is: " + overriddenTitle);
    }
    console.log("✅ Midday rotation override jump works.");

    // Click Done to finish midday rotation
    await page.click('#prMidSubmitBtn');
    await page.waitForTimeout(1000);
    const dashAfterMidday = await page.evaluate(() => document.getElementById('dashView').style.display === 'block');
    if (!dashAfterMidday) {
      throw new Error("Midday Done button failed to transition back to dashboard.");
    }
    console.log("✅ Midday Pass completed successfully.");

    // 7. Test Evening Pass and Record Seam
    console.log("Testing Evening Pass...");
    await page.evaluate(() => go('prayer'));
    await page.waitForTimeout(500);
    await page.click('#prTabEvening');
    await page.waitForTimeout(500);

    // Verify reverse sequence (6, 5, 4)
    const labelM6Exists = await page.textContent('label:has-text("Movement 6")');
    const labelM5Exists = await page.textContent('label:has-text("Movement 5")');
    const labelM4Exists = await page.textContent('label:has-text("Movement 4")');
    if (!labelM6Exists || !labelM5Exists || !labelM4Exists) {
      throw new Error("Evening review layout does not render review prompts.");
    }

    await page.fill('#prEvM6', 'I was lazy today.');
    await page.fill('#prEvM5a', 'My anger');
    await page.fill('#prEvM5b', 'John Doe');
    await page.fill('#prEvM4', 'Needed wisdom and received it.');

    // Save to record
    await page.click('#prEvSubmitBtn');
    await page.waitForTimeout(1000);

    // Verify it returned to dash
    const dashAfterEvening = await page.evaluate(() => document.getElementById('dashView').style.display === 'block');
    if (!dashAfterEvening) {
      throw new Error("Evening Save button failed to transition back to dashboard.");
    }

    // Go to Record view to check if journal entry was logged
    console.log("Checking the Record view for the saved entry...");
    await page.evaluate(() => go('record'));
    await page.waitForTimeout(1000);

    const journalContent = await page.textContent('.dash-content, #recordView');
    if (!journalContent.includes("Movement 6 (Protection): I was lazy today.") ||
        !journalContent.includes("Need forgiven: My anger") ||
        !journalContent.includes("Holding against: John Doe") ||
        !journalContent.includes("Movement 4 (Daily Bread): Needed wisdom and received it.")) {
      throw new Error("Evening review text not found in the Record journal feed! Text found: " + journalContent);
    }
    console.log("✅ Evening Review saved to the Record successfully.");

    // 8. Banned words verification
    console.log("Verifying banned copy rules...");
    const banned = ['streak', 'score', 'progress', 'complete', 'completed', 'behind', 'missed', 'skipped', 'failed', 'daily goal', 'well done', 'keep it up', 'great job'];

    const prayerViewText = await page.evaluate(() => {
      const clone = document.getElementById('prayerView').cloneNode(true);
      clone.querySelectorAll('input, textarea, .pr-surfaced-list, .pr-surfaced-card').forEach(el => el.remove());
      return clone.innerText;
    });
    banned.forEach(word => {
      const regex = new RegExp('\\b' + word + '\\b', 'i');
      if (regex.test(prayerViewText)) {
        throw new Error(`Banned word "${word}" found in prayer surface text!`);
      }
    });
    console.log("✅ Banned copy checks passed.");

    console.log("=== ALL PRAYER SURFACE (PAGE 2) TESTS PASSED SUCCESSFULLY ===");
    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error("Test failed:", err.message);
    await page.screenshot({ path: 'playwright_pillar_page2_error.png' });
    await browser.close();
    process.exit(1);
  }
})();
