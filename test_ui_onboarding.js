const { chromium } = require('playwright');

(async () => {
  console.log("=== RUNNING ONBOARDING GATES & DYNAMIC POPUPS REGRESSION TEST ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.message);
    process.exit(1);
  });

  // Load index.html
  await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });

  // Hide the bootLoader and waGate if needed to interact
  await page.evaluate(() => {
    const loader = document.getElementById('bootLoader');
    if (loader) loader.style.display = 'none';
  });

  // SCENARIO A: Non-member email (gate: 'join')
  console.log("\n--- Testing Scenario A: Non-member 'join' gate ---");
  await page.evaluate(() => {
    // Intercept fetch to mock onboarding-state and skool-profile-lookup
    window.originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (url.includes('onboarding-state')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            verified: false,
            gate: 'join',
            skool_url: 'https://www.skool.com/bakndcreator',
            discount_pct: 10
          })
        };
      }
      if (url.includes('skool-profile-lookup')) {
        return {
          ok: true,
          json: async () => ({ found: false })
        };
      }
      return window.originalFetch(url, options);
    };
  });

  // Type a handle and press Enter to search
  await page.fill('#waHandle', 'invalidhandle');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Click "I'm already a Steward" (which has id waNotFoundSkipBtn)
  await page.click('#waNotFoundSkipBtn');
  await page.waitForTimeout(500);

  // Switch to Sign Up tab, enter email and password, and submit
  await page.click('#waTabSignup');
  await page.fill('#waEmail', 'nonmember@example.com');
  await page.fill('#waPassword', 'password123');
  await page.click('#waSubmitBtn');
  await page.waitForTimeout(1000);

  // Verify that joinModal is opened
  const joinModalOpen = await page.evaluate(() => {
    return document.getElementById('joinModal').classList.contains('open');
  });
  if (!joinModalOpen) {
    console.error("FAIL: joinModal did not open for non-member signup");
    process.exit(1);
  }
  console.log("PASS: joinModal correctly opened for non-member signup");

  // SCENARIO B: Member without quiz (gate: 'quiz')
  console.log("\n--- Testing Scenario B: Member 'quiz' gate ---");
  await page.evaluate(() => {
    // Dismiss/close joinModal first
    closeJoinPopup();
    
    // Mock onboarding-state to return 'quiz'
    window.fetch = async (url, options) => {
      if (url.includes('onboarding-state')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            verified: true,
            gate: 'quiz',
            skool_url: 'https://www.skool.com/bakndcreator',
            discount_pct: 10
          })
        };
      }
      if (url.includes('get-subscription')) {
        return {
          ok: true,
          json: async () => ({
            verified: true,
            member: { member_status: 'member', name: 'Steward User', id: '123' }
          })
        };
      }
      return window.originalFetch(url, options);
    };
  });

  // Trigger login gate flow
  await page.evaluate(async () => {
    localStorage.removeItem('wh_claim_dismissed_month');
    await waRunGate('member@example.com');
  });
  await page.waitForTimeout(2000); // wait for boot and popup trigger timeout

  // Verify that quizOnboardingModal is opened
  const quizModalOpen = await page.evaluate(() => {
    return document.getElementById('quizOnboardingModal').classList.contains('open');
  });
  if (!quizModalOpen) {
    console.error("FAIL: quizOnboardingModal did not open for member without quiz");
    process.exit(1);
  }
  console.log("PASS: quizOnboardingModal correctly opened for member without quiz");

  // Click TAKE THE QUIZ inside onboarding modal
  await page.evaluate(() => {
    startQuizFromOnboarding();
  });
  await page.waitForTimeout(500);

  // Verify it navigated to rhythm view
  const isRhythmViewActive = await page.evaluate(() => {
    return document.getElementById('rhythmView').style.display !== 'none';
  });
  if (!isRhythmViewActive) {
    console.error("FAIL: Did not navigate to rhythm view on quiz prompt click");
    process.exit(1);
  }
  console.log("PASS: Successfully routed to rhythm view from quiz prompt");

  // SCENARIO C: Member with quiz but no bundle (gate: 'bundle')
  console.log("\n--- Testing Scenario C: Member 'bundle' gate ---");
  await page.evaluate(() => {
    // Close quiz modal if open
    closeQuizOnboardingModal();
    localStorage.removeItem('wh_claim_dismissed_month');

    // Mock onboarding-state to return 'bundle'
    window.fetch = async (url, options) => {
      if (url.includes('onboarding-state')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            verified: true,
            gate: 'bundle',
            bundle: { key: 'boss', name: 'Boss + Hydration' },
            skool_url: 'https://www.skool.com/bakndcreator',
            discount_pct: 15,
            discount_code: 'SPECIAL15'
          })
        };
      }
      return window.originalFetch(url, options);
    };
  });

  // Trigger checkClaimModal manually to verify
  await page.evaluate(async () => {
    await checkClaimModal();
  });
  await page.waitForTimeout(2000);

  // Verify claimModal opened and dynamic values populated
  const claimModalOpen = await page.evaluate(() => {
    return document.getElementById('claimModal').classList.contains('open');
  });
  if (!claimModalOpen) {
    console.error("FAIL: claimModal did not open for 'bundle' gate");
    process.exit(1);
  }
  
  const claimModalText = await page.evaluate(() => {
    return document.getElementById('claimModalText').innerHTML;
  });
  if (!claimModalText.includes('15%') || !claimModalText.includes('SPECIAL15')) {
    console.error("FAIL: Dynamic discount values not populated inside claimModal:", claimModalText);
    process.exit(1);
  }
  console.log("PASS: claimModal correctly opened and populated dynamic discount details");

  console.log("\n=== ALL ONBOARDING GATES & POPUP TESTS PASSED ===");
  await browser.close();
  process.exit(0);
})();
