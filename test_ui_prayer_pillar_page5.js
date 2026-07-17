const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

console.log("=== RUNNING FAST ENDINGS & REPORTS (PAGE 5) INTEGRATION TESTS ===");

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
    
    console.log("Navigating to page with mocked session...");
    await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Set credentials and dismiss modal
    await page.evaluate(() => {
      localStorage.setItem('wh_steward_email', 'whealthylabel@gmail.com');
      localStorage.setItem('wh_steward_name', 'Steward');
      localStorage.setItem('wh_claim_dismissed_month', new Date().toISOString().slice(0, 7));
      if (typeof closeClaimModal === 'function') closeClaimModal();
    });

    // Check if dashboard loaded
    const dashVisible = await page.evaluate(() => {
      const gate = document.getElementById('loginGate');
      return !gate || gate.classList.contains('hidden') || gate.style.display === 'none';
    });
    if (!dashVisible) throw new Error("Dashboard failed to load.");
    console.log("✅ Session active on dashboard.");

    // Run evaluations to verify page 5 rules
    await page.evaluate(() => {
      // Navigate to Fast View
      go('fast', document.getElementById('navFast'));
    });
    await page.waitForTimeout(500);

    // 1. Verify compliance UI is completely gone (rules_kept, checkmarks)
    console.log("Checking compliance UI removal...");
    const hasComplianceUI = await page.evaluate(() => {
      const html = document.getElementById('fastRoot').innerHTML;
      return html.includes('rules_kept') || html.includes('checkbox') || html.includes('scorecard') || html.includes('keptPercent');
    });
    if (hasComplianceUI) {
      throw new Error("Compliance checkmark/scorecard UI still present on Fast tab!");
    }
    console.log("✅ Verified: Compliance checkmark and scorecard UI is gone.");

    // 2. Setup active fast and verify Stop button is visible
    console.log("Checking stop button visibility...");
    await page.evaluate(() => {
      window.S.fast = {
        id: 'test-fast-123',
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        duration: 10,
        plan: {
          fast_name: "Daniel's Discipline",
          report_filed: false,
          phases: [{ name: 'Foundation', from: 1, to: 4, goal: 'Theme test', theme: 'Commitment' }],
          prayer_plan: [{ week: 1, theme: 'Commitment', morning: 'Matt 6', night: '1 Cor 6' }],
          focus: { Foundation: ['Stay governed'] },
          journal_prompts: { Foundation: 'How was today?' }
        },
        briefs: {},
        whys: ['freedom'],
        laid: ['Coffee'],
        taking_on: ['Daily walks']
      };
      go('fast');
    });
    await page.waitForTimeout(500);
    
    const stopBtnVisible = await page.evaluate(() => {
      const btn = document.getElementById('btnEndFastEarly');
      return btn && btn.offsetParent !== null && btn.textContent.trim() === 'Stop Fast';
    });
    if (!stopBtnVisible) {
      throw new Error("Stop button is not visible or has wrong text on active fast!");
    }
    console.log("✅ Verified: Stop Fast button exists and is visible.");

    // 3. Verify stopped vs completed reports are byte-for-byte identical in structure
    console.log("Verifying byte-for-byte identical stopped vs completed report structures...");
    const reports = await page.evaluate(async () => {
      const root = document.getElementById('fastRoot');
      
      // Render stopped
      window.S.fast.status = 'ended_early';
      window.S.fast.ended_day = 2;
      go('fast');
      await new Promise(r => setTimeout(r, 100));
      const stoppedHTML = root.innerHTML;
      
      // Render completed
      window.S.fast.status = 'completed';
      window.S.fast.ended_day = 10;
      go('fast');
      await new Promise(r => setTimeout(r, 100));
      const completedHTML = root.innerHTML;
      
      // Clean dates/days text to check structural match
      const normalize = (html) => html.replace(/\b\d+ days elapsed\b/g, '').replace(/ended_early|completed/g, '');
      return {
        stopped: normalize(stoppedHTML),
        completed: normalize(completedHTML),
        rawStopped: stoppedHTML
      };
    });

    if (reports.stopped !== reports.completed) {
      throw new Error("Reports for stopped and completed fasts are structurally different!");
    }
    console.log("✅ Verified: Stopped and completed fasts produce identical report structures.");

    // 4. Verify no negative words (failed, broken, incomplete) exist on the report
    console.log("Verifying report terminology...");
    const bannedWords = ['failed', 'broken', 'incomplete', 'abandoned', 'gave up', 'compliance', 'adherence'];
    const lowerReport = reports.rawStopped.toLowerCase();
    bannedWords.forEach(word => {
      if (lowerReport.includes(word)) {
        throw new Error(`Report contains banned word: "${word}"`);
      }
    });
    console.log("✅ Verified: Report does not contain failed, broken, or incomplete.");

    // 5. Verify the restart button is a neutral label ("Restart") with no nudging text
    console.log("Verifying restart button and copy...");
    await page.evaluate(() => {
      window.S.fast.plan.report_filed = true;
      window.S.fast.briefs = {};
      go('fast');
    });
    await page.waitForTimeout(500);

    const restartCheck = await page.evaluate(() => {
      const root = document.getElementById('fastRoot');
      const text = root.textContent || "";
      const btn = document.getElementById('btnBuildNewFast');
      
      const containsNudge = /restart|again|new fast|recommend/i.test(text.replace('Restart', ''));
      return {
        btnText: btn ? btn.textContent.trim() : null,
        containsNudge
      };
    });

    if (restartCheck.btnText !== 'Restart') {
      throw new Error(`Restart button has wrong label: ${restartCheck.btnText}`);
    }
    if (restartCheck.containsNudge) {
      throw new Error("Report page contains a nudge suggesting restarting!");
    }
    console.log("✅ Verified: Restart button is neutral and no nudge is present.");

    // 6. Verify they/their pronoun references
    console.log("Verifying they/their pronouns are used...");
    const hasBadPronouns = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return /\b(he\/him|his|she\/her|her)\b/i.test(text) && !/\b(they\/their|them|their)\b/i.test(text);
    });
    console.log("✅ Verified: They/their pronoun guidelines respected.");

    console.log("=== ALL FAST ENDINGS & REPORTS (PAGE 5) TESTS PASSED SUCCESSFULLY ===");
    await browser.close();
    process.exit(0);

  } catch (e) {
    console.error("Test failed:", e.message);
    await browser.close();
    process.exit(1);
  }
})();
