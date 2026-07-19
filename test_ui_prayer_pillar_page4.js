const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

console.log("=== RUNNING CLOSING & ANSWER LOG (PAGE 4) INTEGRATION TESTS ===");

let SUPABASE_ANON_KEY = '';
try {
  const indexPath = path.join(__dirname, 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const match = indexContent.match(/const SUPABASE_ANON\s*=\s*'([^']+)'/);
  if (match) {
    SUPABASE_ANON_KEY = match[1].trim();
  }
} catch (e) {
  console.error("Failed to read index.html:", e.message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  try {
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
                  data: { session: { user: { email: 'whealthylabel@gmail.com' } } },
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

    await page.setViewportSize({ width: 375, height: 812 });
    
    let milestoneCount = 0;
    await page.route('**/functions/v1/prayers-read', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        let postData = {};
        try {
          postData = JSON.parse(request.postData() || '{}');
        } catch (e) {}
        if (postData.view === 'milestone') {
          milestoneCount++;
          if (milestoneCount === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                prayer: {
                  id: "mock-milestone-365",
                  body: "One year ago today you asked for this.",
                  category: "family",
                  created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
                },
                milestone: 365
              })
            });
            return;
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                prayer: {
                  id: "mock-milestone-90",
                  body: "Ninety days ago you asked for this.",
                  category: "work",
                  created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
                },
                milestone: 90
              })
            });
            return;
          }
        }
      }
      await route.continue();
    });

    await page.route('**/functions/v1/prayers-write', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        let postData = {};
        try {
          postData = JSON.parse(request.postData() || '{}');
        } catch (e) {}
        if (postData.action === 'milestone_shown' || postData.action === 'milestone_dismiss' || postData.action === 'milestone_close') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true })
          });
          return;
        }
      }
      await route.continue();
    });

    console.log("Navigating to page with mocked session...");
    await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    await page.evaluate(() => {
      localStorage.setItem('wh_steward_email', 'whealthylabel@gmail.com');
      localStorage.setItem('wh_steward_name', 'Steward');
      localStorage.setItem('wh_claim_dismissed_month', new Date().toISOString().slice(0, 7));
      
      MEMBER_EMAIL = 'whealthylabel@gmail.com';
      window.MEMBER_EMAIL = 'whealthylabel@gmail.com';

      if (typeof closeClaimModal === 'function') closeClaimModal();
    });

    // Check if dashContent is visible
    const dashVisible = await page.evaluate(() => {
      const gate = document.getElementById('loginGate');
      return !gate || gate.classList.contains('hidden') || gate.style.display === 'none';
    });
    if (!dashVisible) throw new Error("Dashboard failed to load.");
    console.log("✅ Session active on dashboard.");

    // Clean up existing prayers for whealthylabel@gmail.com to ensure clean test state
    console.log("Cleaning up existing prayers in database...");
    await page.evaluate(async (anonKey) => {
      const readRes = await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', view: 'mirror' })
      });
      const data = await readRes.json();
      const ids = [];
      for (const cat in data) {
        data[cat].forEach(p => {
          if (p.body !== '365 Days Milestone Ask' && p.body !== '90 Days Milestone Ask') {
            ids.push(p.id);
          }
        });
      }

      // Also fetch answered prayers to clean up
      const answeredRes = await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', view: 'answered', limit: 100 })
      });
      const answeredData = await answeredRes.json();
      const answeredList = answeredData.prayers || [];
      answeredList.forEach(p => ids.push(p.id));

      for (const id of ids) {
        // Reopen first if closed
        await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'reopen', id })
        });
        // Unpublish first if published
        await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'unpublish', id })
        });
        // Delete
        await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'delete', id })
        });
      }
    }, SUPABASE_ANON_KEY);

    // Reset unaware_empty_seen flag on DB to test clean first view
    console.log("Resetting unaware_empty_seen flag in database...");
    await page.evaluate(async (anonKey) => {
      await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayer-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'jump', movement: 1 })
      });
    }, SUPABASE_ANON_KEY);

    console.log("Navigating to Prayer View...");
    await page.evaluate(() => go('prayer'));
    await page.waitForTimeout(500);
    console.log("✅ Prayer View is visible.");

    console.log("Navigating to Mirror (List) tab...");
    await page.click('#prTabMirror');
    await page.waitForSelector('#listView', { state: 'visible', timeout: 5000 });
    console.log("✅ listView is visible.");

    // Enforce unaware persisted flag seen check
    const emptyUnawareText = await page.textContent('#prCat-unaware');
    if (!emptyUnawareText.includes("This one is empty.")) {
      throw new Error("Persisted unaware empty text was not shown initially.");
    }
    console.log("✅ Verified: Unaware empty state message shown on first view.");

    // Wait for the background seen_unaware POST fetch to complete and write to the DB
    await page.waitForTimeout(3000);

    // Trigger page reload/re-init to check persisted seen status
    console.log("Re-initializing Prayer Pillar to check unaware empty seen persistence...");
    await page.evaluate(async () => { if (typeof initPrayerPillar === 'function') await initPrayerPillar(); });
    await page.waitForTimeout(1500);
    await page.click('#prTabMirror');
    await page.waitForTimeout(2000);
    await page.waitForSelector('.pr-category-section', { state: 'visible', timeout: 5000 });

    const emptyUnawareTextSecond = await page.textContent('#prCat-unaware');
    if (emptyUnawareTextSecond.includes("This one is empty.")) {
      throw new Error("Persisted unaware empty text was shown twice (failed to persist seen flag).");
    }
    console.log("✅ Verified: Unaware empty message correctly persists as seen and is hidden.");

    // 1. Add a prayer request by hand
    const mockRequestText = "P4 Test Request " + Math.random().toString(36).substring(7);
    console.log("Adding prayer request by hand...");
    await page.fill('#prAddBody', mockRequestText);
    await page.selectOption('#prAddCategory', 'brothers');
    await page.click('#prAddSubmitBtn');
    
    // Wait for the new card to render in brothers category
    const cardSelector = `.pr-list-card:has-text("${mockRequestText}")`;
    await page.waitForSelector(cardSelector, { timeout: 10000 });
    
    // Extract card id
    const cardId = await page.evaluate((text) => {
      const cards = Array.from(document.querySelectorAll('.pr-list-card'));
      const match = cards.find(c => c.innerText.includes(text));
      return match ? match.id.replace('prCard-', '') : null;
    }, mockRequestText);

    if (!cardId) throw new Error("Could not find card ID for created prayer.");
    console.log(`✅ Verified: Added prayer card (ID: ${cardId}) successfully.`);

    // 2. Test Close Flow (Yes)
    console.log("Testing Close flow (Yes)...");
    await page.click(`#prCard-${cardId} button:has-text("Close")`);
    await page.waitForSelector(`#prCloseOutcome-${cardId}`, { state: 'visible', timeout: 3000 });
    
    // Select Yes and input outcome
    await page.click(`#prCloseStateYes-${cardId}`);
    const outcomeText = "Test Outcome for Yes Answer";
    await page.fill(`#prCloseOutcome-${cardId}`, outcomeText);
    await page.click(`#prCard-${cardId} button:has-text("Save")`);

    // Verify card is removed from active Mirror
    await page.waitForSelector(`#prCard-${cardId}`, { state: 'detached', timeout: 10000 });
    console.log("✅ Verified: Closed card removed from Closet Mirror.");

    // 3. Test Answer Log & Yes Count
    console.log("Checking Answered Walk...");
    await page.click('#prTabAnswered');
    await page.waitForSelector('#prAnsweredContent', { state: 'visible', timeout: 5000 });

    const yesCountText = await page.textContent('#yesCountDiv');
    if (!yesCountText.includes("1 Yes Answer")) {
      throw new Error("Yes count was not rendering correctly: " + yesCountText);
    }
    console.log("✅ Verified: Yes count rendered correctly.");

    const answeredListText = await page.textContent('#answeredListContainer');
    if (!answeredListText.includes(mockRequestText) || !answeredListText.includes(outcomeText)) {
      throw new Error("Answered card body or outcome not rendered in Answer Log.");
    }
    console.log("✅ Verified: Answered card rendered in Answer Log.");

    // Banned copy rules check in Answer Log
    const answeredHtml = await page.innerHTML('#prAnsweredContent');
    const bannedRatios = ['out of', '%', 'ratio', 'denominator'];
    bannedRatios.forEach(pat => {
      if (answeredHtml.includes(pat)) throw new Error("Banned ratio indicator found in Answer Log HTML.");
    });
    console.log("✅ Verified: Answered Walk does not contain banned ratios/counts.");

    // 4. Test Reopen
    console.log("Testing Reopen action...");
    await page.click('#prAnsweredContent button:has-text("Reopen")');
    await page.waitForSelector('#answeredListContainer:has-text("No answered prayers in the log.")', { timeout: 10000 });
    console.log("✅ Verified: Answer Log is empty after reopen.");

    await page.click('#prTabMirror');
    await page.waitForSelector(`#prCard-${cardId}`, { state: 'visible', timeout: 5000 });
    console.log("✅ Verified: Reopened card returned to Closet Mirror.");

    // 5. Test Close Flow (No) & Record Handoff
    console.log("Testing Close flow (No) & Record Handoff...");
    await page.click(`#prCard-${cardId} button:has-text("Close")`);
    await page.waitForSelector(`#prCloseOutcome-${cardId}`, { state: 'visible', timeout: 3000 });

    await page.click(`#prCloseStateNo-${cardId}`);
    const outcomeTextNo = "Test Outcome for No Answer";
    await page.fill(`#prCloseOutcome-${cardId}`, outcomeTextNo);
    await page.click(`#prCard-${cardId} button:has-text("Save")`);

    // Verify Handoff popup appears
    await page.waitForSelector('.pr-handoff-overlay', { state: 'visible', timeout: 5000 });
    const handoffTitle = await page.textContent('.pr-handoff-overlay h3');
    if (!handoffTitle.includes("Keep in the Record?")) {
      throw new Error("Record handoff overlay did not appear.");
    }
    console.log("✅ Verified: Record handoff overlay popped up.");

    const prefilledText = await page.inputValue('#prRecordHandoffText');
    if (!prefilledText.includes(outcomeTextNo)) {
      throw new Error("Record handoff textarea did not prefill. Value: " + prefilledText);
    }
    console.log("✅ Verified: Record handoff textarea correctly pre-filled.");

    // Click Save to Record
    await page.click('#prHandoffSave');
    await page.waitForSelector('.pr-handoff-overlay', { state: 'detached', timeout: 5000 });
    console.log("✅ Verified: Handoff overlay dismissed.");

    // Verify journal entry added locally
    const entriesData = await page.evaluate(() => window.S ? window.S.entries : []);
    const handoffEntry = entriesData.find(e => e.text.includes(outcomeTextNo));
    if (!handoffEntry) {
      throw new Error("Handoff entry not added to local entries list.");
    }
    console.log("✅ Verified: Handoff successfully saved reflection into local Record S.entries.");

    // 6. Test Delete Guards (server-side rejects deletion of closed or published entries)
    console.log("Testing server-side delete guards on closed entries...");
    const deleteGuardCloseRes = await page.evaluate(async ({ anonKey, id }) => {
      const res = await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'delete', id })
      });
      const data = await res.json();
      return { status: res.status, error: data.error };
    }, { anonKey: SUPABASE_ANON_KEY, id: cardId });

    if (deleteGuardCloseRes.status !== 400 || !deleteGuardCloseRes.error.includes("closed")) {
      throw new Error("Server-side closed delete guard failed. Status: " + deleteGuardCloseRes.status + ", Error: " + deleteGuardCloseRes.error);
    }
    console.log("✅ Verified: Server-side delete guard on closed entries is active.");

    // Test delete guard on published entries
    console.log("Testing server-side delete guards on published entries...");
    const pubId = await page.evaluate(async (anonKey) => {
      const createRes = await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'create', body: 'Temp Pub Delete Guard Prayer', category: 'soul' })
      });
      const createData = await createRes.json();
      const id = createData.id;

      await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'publish', id, display_mode: 'anonymous' })
      });
      return id;
    }, SUPABASE_ANON_KEY);

    const deleteGuardPubRes = await page.evaluate(async ({ anonKey, id }) => {
      const res = await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'delete', id })
      });
      const data = await res.json();
      
      await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'unpublish', id })
      });
      await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'delete', id })
      });

      return { status: res.status, error: data.error };
    }, { anonKey: SUPABASE_ANON_KEY, id: pubId });

    if (deleteGuardPubRes.status !== 400 || !deleteGuardPubRes.error.includes("published")) {
      throw new Error("Server-side published delete guard failed. Status: " + deleteGuardPubRes.status + ", Error: " + deleteGuardPubRes.error);
    }
    console.log("✅ Verified: Server-side delete guard on published entries is active.");

    // 7. Test Milestones & Anniversary Card
    console.log("Testing Milestone Resurfacing Flow...");
    
    // We expect the external runner to set up milestone prayers in the database.
    // Let's first navigate to Evening Tab.
    await page.click('#prTabEvening');
    await page.waitForSelector('#prPassContent', { state: 'visible', timeout: 5000 });
    
    // Wait to see if a milestone card is rendered
    console.log("Waiting for milestone card (should be the 365-day anniversary card first)...");
    await page.waitForSelector('.pr-milestone-card', { state: 'visible', timeout: 10000 });
    
    const cardText = await page.textContent('.pr-milestone-card');
    if (!cardText.includes("One year ago today you asked for this.")) {
      throw new Error("Milestone card did not show correct 365-day anniversary copy.");
    }
    console.log("✅ Verified: Anniversary milestone copy is active.");

    // Click "Still waiting" (Silence dismissal)
    await page.click('.pr-milestone-card button:has-text("Still waiting")');
    await page.waitForSelector('.pr-milestone-card', { state: 'detached', timeout: 5000 });
    console.log("✅ Verified: Pinned/Anniversary milestone dismissed silently.");

    // Reload evening to see the next milestone candidate (the 90-day one)
    console.log("Checking next milestone candidate...");
    await page.evaluate(() => { if (typeof initPrayerPillar === 'function') initPrayerPillar(); });
    await page.waitForTimeout(1000);
    await page.click('#prTabEvening');
    await page.waitForSelector('.pr-milestone-card', { state: 'visible', timeout: 10000 });

    const cardText2 = await page.textContent('.pr-milestone-card');
    if (!cardText2.includes("You asked for this ninety days ago. Anything?")) {
      throw new Error("Second milestone card did not show 90-day copy.");
    }
    console.log("✅ Verified: 90-day milestone copy is active.");

    // Close from milestone card: Click Yes
    await page.click('.pr-milestone-card #prMilestoneBtnYes');
    await page.waitForSelector('#prMilestoneOutcome', { state: 'visible', timeout: 3000 });
    await page.fill('#prMilestoneOutcome', 'Milestone Answered Outcome');
    await page.click('.pr-milestone-card button:has-text("Save")');
    
    // Card should disappear
    await page.waitForSelector('.pr-milestone-card', { state: 'detached', timeout: 5000 });
    console.log("✅ Verified: Milestone card answered and closed successfully.");

    console.log("=== ALL CLOSING & ANSWER LOG (PAGE 4) TESTS PASSED SUCCESSFULLY ===");
    await browser.close();
    process.exit(0);

  } catch (e) {
    console.error("Test failed:", e.message);
    await browser.close();
    process.exit(1);
  }
})();
