const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

console.log("=== RUNNING PRAYER LIST & MIRROR (PAGE 3) INTEGRATION TESTS ===");

// Parse Anon Key from index.html
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

    // Set viewport for mobile responsiveness checks
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone XS dimensions
    
    // 2. Go to page
    console.log("Navigating to page with mocked session...");
    await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Set credentials and dismiss modal
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
      throw new Error("Dashboard failed to load.");
    }
    console.log("✅ Session active on dashboard.");

    // Reset unaware_empty_seen flag in database
    console.log("Resetting unaware_empty_seen flag in database...");
    await page.evaluate(async (anonKey) => {
      await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayer-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email: 'whealthylabel@gmail.com', action: 'jump', movement: 1, unaware_empty_seen: false })
      });
    }, SUPABASE_ANON_KEY);

    // Clean up any existing open unaware prayers to ensure unaware is empty initially
    console.log("Cleaning up existing unaware prayers in database...");
    await page.evaluate(async (anonKey) => {
      const res = await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          email: 'whealthylabel@gmail.com',
          view: 'mirror'
        })
      });
      const data = await res.json();
      if (data && data.unaware && data.unaware.length > 0) {
        for (const p of data.unaware) {
          if (p.state === 'not_yet' && !p.wall_post_id) {
            await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`
              },
              body: JSON.stringify({
                email: 'whealthylabel@gmail.com',
                action: 'delete',
                id: p.id
              })
            });
          }
        }
      }
    }, SUPABASE_ANON_KEY);

    // Navigate to Prayer View
    await page.evaluate(() => go('prayer'));
    await page.waitForTimeout(3000);

    const prayerVisible = await page.evaluate(() => document.getElementById('prayerView').style.display === 'block');
    if (!prayerVisible) {
      throw new Error("Prayer View failed to render.");
    }
    console.log("✅ Prayer View is visible.");

    // 3. Navigate to Mirror view
    console.log("Navigating to Mirror (List) tab...");
    await page.click('#prTabMirror');
    await page.waitForSelector('.pr-category-section', { timeout: 10000 });

    const listVisible = await page.evaluate(() => document.getElementById('listView').style.display === 'block');
    if (!listVisible) {
      throw new Error("listView failed to render.");
    }
    console.log("✅ listView is visible.");

    // 4. Verify all 5 categories render
    const categoriesRendered = await page.evaluate(() => {
      const cats = ['household', 'soul', 'provision', 'brothers', 'unaware'];
      return cats.every(c => !!document.getElementById(`prCat-${c}`));
    });
    if (!categoriesRendered) {
      throw new Error("One or more of the 5 categories are missing from the Mirror view.");
    }
    console.log("✅ Verified: All 5 categories are rendered in the Mirror.");

    // 5. Verify the Unaware category "This one is empty" session rule
    const unawareEmptyText = await page.textContent('#prCat-unaware');
    if (!unawareEmptyText.includes("This one is empty.")) {
      throw new Error("Empty unaware category did not display 'This one is empty.' initially.");
    }
    console.log("✅ Verified: Unaware empty state message is shown.");

    // Toggle tabs and check that the unaware message is gone
    console.log("Clicking away to Midday tab and back to Mirror...");
    await page.click('#prTabMidday');
    await page.waitForTimeout(300);
    await page.click('#prTabMirror');
    await page.waitForTimeout(1000);

    const unawareEmptyTextAfter = await page.textContent('#prCat-unaware');
    if (unawareEmptyTextAfter.includes("This one is empty.")) {
      throw new Error("Session rule violation: 'This one is empty.' surfaced a second time in the same session.");
    }
    console.log("✅ Verified: Unaware empty state message is hidden on second surfacing.");

    // 6. Test Add by Hand
    console.log("Testing Add by Hand flow...");
    // Try submitting without body or category
    page.once('dialog', async dialog => {
      if (dialog.message().includes("Please select a category") || dialog.message().includes("Please write the prayer")) {
        await dialog.accept();
      } else {
        throw new Error("Unexpected dialog: " + dialog.message());
      }
    });
    await page.click('#prAddSubmitBtn');
    await page.waitForTimeout(200);

    // Fill request
    const mockRequestText = "Carry weight test: " + Math.random().toString(36).substring(7);
    await page.fill('#prAddBody', mockRequestText);
    await page.selectOption('#prAddCategory', 'brothers');

    await page.click('#prAddSubmitBtn');
    await page.waitForTimeout(2000); // Wait for Edge Function response and reload

    const brothersText = await page.textContent('#prCat-brothers');
    if (!brothersText.includes(mockRequestText)) {
      throw new Error("Newly added prayer did not appear in the Mirror under 'brothers'.");
    }
    console.log("✅ Verified: Add by Hand successfully stored and rendered the prayer.");

    // Get the card ID for the created prayer
    const cardId = await page.evaluate((text) => {
      const card = Array.from(document.querySelectorAll('.pr-list-card')).find(el => el.textContent.includes(text));
      return card ? card.id.replace('prCard-', '') : null;
    }, mockRequestText);

    if (!cardId) {
      throw new Error("Failed to extract card ID.");
    }

    // 7. Verify Pin / Unpin
    console.log("Testing Pin / Unpin toggle...");
    const pinBtnSelector = `#prCard-${cardId} .pr-pin-btn`;
    const classesBefore = await page.getAttribute(pinBtnSelector, 'class') || '';
    if (classesBefore.includes('pinned')) {
      throw new Error("Card should start unpinned.");
    }

    await page.click(pinBtnSelector);
    await page.waitForSelector(`#prCard-${cardId} .pr-pin-btn.pinned`, { timeout: 10000 });
    console.log("✅ Verified: Pin state toggle works.");

    // 8. Verify Edit action (body only, no other fields)
    console.log("Testing Edit action (body only)...");
    const editBtnSelector = `#prCard-${cardId} button:has-text("Edit")`;
    await page.click(editBtnSelector);
    await page.waitForTimeout(300);

    const editTextareaSelector = `#prEditBody-${cardId}`;
    const editedText = mockRequestText + " (Edited)";
    await page.fill(editTextareaSelector, editedText);
    await page.click(`#prCard-${cardId} button:has-text("Save")`);
    await page.waitForSelector(`#prEditBody-${cardId}`, { state: 'detached', timeout: 10000 });

    const brothersTextAfterEdit = await page.textContent('#prCat-brothers');
    if (!brothersTextAfterEdit.includes(editedText)) {
      throw new Error("Edit did not update the body text in the Mirror.");
    }
    console.log("✅ Verified: Edit body updates and re-renders successfully.");

    // 9. Verify Publish / Unpublish flows
    console.log("Testing Publish / Unpublish flow...");
    const publishBtnSelector = `#prCard-${cardId} button:has-text("Publish")`;
    await page.click(publishBtnSelector);
    await page.waitForTimeout(300);

    // Verify option buttons (Signed / Anon) are shown
    const signBtn = page.locator(`#prCard-${cardId} button:has-text("Signed")`);
    const anonBtn = page.locator(`#prCard-${cardId} button:has-text("Anon")`);
    if (!(await signBtn.isVisible()) || !(await anonBtn.isVisible())) {
      throw new Error("Publish options (Signed/Anon) did not render.");
    }

    // Click Signed
    await signBtn.click();
    const unpublishBtn = page.locator(`#prCard-${cardId} button:has-text("Unpublish")`);
    await unpublishBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log("✅ Verified: Publish flow correctly requests signature mode and links post.");

    // Click Unpublish
    await unpublishBtn.click();
    const publishBtnAfter = page.locator(publishBtnSelector);
    await publishBtnAfter.waitFor({ state: 'visible', timeout: 10000 });
    console.log("✅ Verified: Unpublish archives wall post and returns card to local closet state.");

    // 10. Verify Delete action
    console.log("Testing Delete action...");
    // Auto-accept delete confirm dialog
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    const deleteBtnSelector = `#prCard-${cardId} button:has-text("Delete")`;
    await page.click(deleteBtnSelector);
    await page.waitForSelector(`#prCard-${cardId}`, { state: 'detached', timeout: 10000 });

    const brothersTextAfterDelete = await page.textContent('#prCat-brothers');
    if (brothersTextAfterDelete.includes(editedText)) {
      throw new Error("Delete action failed to remove card from Mirror.");
    }
    console.log("✅ Verified: Delete action removes card successfully.");

    // 11. Verify Movement 4 carry handoff
    console.log("Testing Movement 4 Carry Handoff...");
    await page.click('#prTabMorning');
    await page.waitForTimeout(500);

    // Navigate to Movement 4
    for (let i = 1; i < 4; i++) {
      await page.fill('#prInput', `M${i} Answer`);
      await page.click('button[onclick="PRAYER.nextMorningStep()"]');
      await page.waitForTimeout(300);
    }

    const m4Title = await page.textContent('.pr-title');
    if (!m4Title.includes("Give us this day")) {
      throw new Error("Failed to navigate to Movement 4.");
    }

    // Fill bread request and carry
    const breadText = "Bread request carry text";
    await page.fill('#prInput', breadText);
    await page.click('button:has-text("Carry this")');
    await page.waitForTimeout(500);

    // Verify it switched to Mirror tab
    const isMirrorActive = await page.evaluate(() => document.getElementById('listView').style.display === 'block');
    if (!isMirrorActive) {
      throw new Error("Carry this button failed to navigate to Mirror view.");
    }

    // Verify the add-by-hand textarea is pre-filled
    const prefilledVal = await page.inputValue('#prAddBody');
    if (prefilledVal !== breadText) {
      throw new Error("Add form textarea did not pre-fill. Value: " + prefilledVal);
    }
    console.log("✅ Verified: Movement 4 handoff pre-fills create flow without auto-inserting.");

    // 12. Server-side guard checks
    console.log("Testing server-side delete and update guards...");
    const guardResults = await page.evaluate(async (anonKey) => {
      const res = await fetch('https://yzaxzmuuvozonhgwhlim.supabase.co/functions/v1/prayers-write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          email: 'whealthylabel@gmail.com',
          action: 'update',
          id: '57eb87fc-5290-43aa-ab18-604578d635f1', // a closed prayer
          category: 'soul'
        })
      });
      const data = await res.json();
      return { status: res.status, error: data.error };
    }, SUPABASE_ANON_KEY);

    if (guardResults.status !== 400 || !guardResults.error.includes("immutable")) {
      throw new Error("Server-side immutable category guard failed. Status: " + guardResults.status + ", Error: " + guardResults.error);
    }
    console.log("✅ Verified: Server-side immutable update guard is active.");

    // 13. Banned copy check
    console.log("Verifying banned copy rules...");
    const banned = ['streak', 'score', 'progress', 'complete', 'completed', 'behind', 'missed', 'skipped', 'failed', 'daily goal', 'well done', 'keep it up', 'great job'];
    const prayerViewText = await page.evaluate(() => {
      const clone = document.getElementById('prayerView').cloneNode(true);
      clone.querySelectorAll('input, textarea, .pr-surfaced-list, .pr-surfaced-card, .pr-list-card').forEach(el => el.remove());
      return clone.innerText;
    });
    banned.forEach(word => {
      const regex = new RegExp('\\b' + word + '\\b', 'i');
      if (regex.test(prayerViewText)) {
        throw new Error(`Banned word "${word}" found in prayer surface text!`);
      }
    });
    console.log("✅ Verified: Banned words checks passed.");

    console.log("=== ALL PRAYER LIST & MIRROR (PAGE 3) TESTS PASSED SUCCESSFULLY ===");
    await browser.close();
    process.exit(0);

  } catch (err) {
    console.error("Test failed:", err.message);
    await page.screenshot({ path: 'playwright_pillar_page3_error.png' });
    await browser.close();
    process.exit(1);
  }
})();
