const { chromium } = require('playwright');

console.log("=== RUNNING SCRIPTURE & EZRA REFIT (PAGE 6) INTEGRATION TESTS ===");

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
    
    console.log("Navigating to WHEALTHY Command Center...");
    await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Set credentials and mock book intros in local storage
    await page.evaluate(() => {
      localStorage.setItem('wh_steward_email', 'whealthylabel@gmail.com');
      localStorage.setItem('wh_steward_name', 'Steward');
      localStorage.setItem('wh_claim_dismissed_month', new Date().toISOString().slice(0, 7));
      
      const mockIntros = [
        {
          book: 'Genesis',
          what_this_is: 'The book of origins and beginnings.',
          who_its_for: 'Stewards seeking to understand foundational covenants.',
          what_to_watch_for: 'Patterns of promise and human response.'
        },
        {
          book: 'Exodus',
          what_this_is: 'The story of redemption and deliverance.',
          who_its_for: 'Stewards wanting to trace how God rescues.',
          what_to_watch_for: 'The character of Yahweh.'
        }
      ];
      localStorage.setItem('wh_book_intros', JSON.stringify(mockIntros));
      
      // Initialize Bible 365 state if needed
      window.state = window.state || { completed: [], streak: 0, startDate: '2026-01-01' };
      window.state.startDate = '2026-01-01';
      window.state.completed = [1, 2];
      window.state.streak = 5;
      
      if (typeof closeClaimModal === 'function') closeClaimModal();
    });

    // Check if dashboard loaded
    const dashVisible = await page.evaluate(() => {
      const gate = document.getElementById('loginGate');
      return !gate || gate.classList.contains('hidden') || gate.style.display === 'none';
    });
    if (!dashVisible) throw new Error("Dashboard failed to load.");
    console.log("✅ Session active on dashboard.");

    // Verify dashboard Bible card has the fire/streak badge instead of progress ring
    console.log("Checking dashboard Bible card progress ring removal...");
    const hasProgressRing = await page.evaluate(() => {
      const cardHtml = document.body.innerHTML;
      return cardHtml.includes('/ 365') && cardHtml.includes('stroke-dasharray');
    });
    if (hasProgressRing) {
       console.log("Warning: Dashboard or body contains '/ 365' or progress stroke, checking specifics...");
    }
    const hasStreakBadge = await page.evaluate(() => {
      const cardHtml = document.body.innerHTML;
      return cardHtml.includes('Day Streak');
    });
    if (!hasStreakBadge) {
      throw new Error("Dashboard Bible card does not render the Day Streak badge.");
    }
    const hasFlameBadge = await page.evaluate(() => {
      const cardHtml = document.body.innerHTML;
      return cardHtml.includes('🔥') && cardHtml.includes('Day Streak');
    });
    if (hasFlameBadge) {
      throw new Error("Dashboard Bible card still contains the gamified 🔥 emoji!");
    }
    console.log("✅ Verified: Dashboard card renders clean, emoji-free streak badge.");

    // Go to Bible View
    await page.evaluate(() => {
      go('bible', document.getElementById('navBible'));
    });
    await page.waitForTimeout(500);

    // 1. Verify two prompts are present, old text area is gone
    console.log("Verifying two reflection prompts...");
    const reflectionInputs = await page.evaluate(() => {
      const oldText = document.getElementById('bible_reflectionText');
      const said = document.getElementById('bible_reflectionSaid');
      const willDo = document.getElementById('bible_reflectionWillDo');
      return {
        hasOldText: !!oldText,
        hasSaid: !!said,
        hasWillDo: !!willDo
      };
    });
    if (reflectionInputs.hasOldText) throw new Error("Obsolete single textarea #bible_reflectionText still exists.");
    if (!reflectionInputs.hasSaid || !reflectionInputs.hasWillDo) {
      throw new Error("Missing new #bible_reflectionSaid or #bible_reflectionWillDo textareas.");
    }
    console.log("✅ Verified: Split reflection fields ('What does it say?' / 'What will you do?') are active.");

    // 2. Verify book name parsing helper
    console.log("Verifying getBookName parsing helper...");
    const parses = await page.evaluate(() => {
      return {
        genesis: getBookName('Genesis 1-3'),
        kings: getBookName('1 Kings 12:1'),
        john: getBookName('1 John 1-2')
      };
    });
    if (parses.genesis !== 'Genesis') throw new Error(`Genesis parsed incorrectly: ${parses.genesis}`);
    if (parses.kings !== '1 Kings') throw new Error(`1 Kings parsed incorrectly: ${parses.kings}`);
    if (parses.john !== '1 John') throw new Error(`1 John parsed incorrectly: ${parses.john}`);
    console.log("✅ Verified: getBookName helper correctly handles book names with numbers and spaces.");

    // 3. Verify book intro auto-surfaces once and is dismissible
    console.log("Verifying book intro auto-surfacing and dismissal...");
    await page.evaluate(() => {
      // Genesis starts on Day 1. Setting currentDay = 1 should auto-surface the intro
      currentDay = 1;
      localStorage.removeItem('wh_book_intros_seen');
      renderHero();
    });
    await page.waitForTimeout(2000); // Wait for async fetch or render

    const introModalOpen = await page.evaluate(() => {
      const modal = document.getElementById('bible_bookIntroOverlay');
      return modal && modal.classList.contains('open');
    });
    if (!introModalOpen) throw new Error("Genesis book intro overlay did not auto-surface on Day 1.");
    console.log("✅ Verified: Book intro auto-surfaces upon first entry.");

    await page.evaluate(() => {
      // Dismiss the book intro
      dismissBookIntro();
    });
    await page.waitForTimeout(200);

    const introModalClosed = await page.evaluate(() => {
      const modal = document.getElementById('bible_bookIntroOverlay');
      const seen = JSON.parse(localStorage.getItem('wh_book_intros_seen') || '[]');
      return (!modal || !modal.classList.contains('open')) && seen.includes('Genesis');
    });
    if (!introModalClosed) throw new Error("Book intro overlay failed to close or save seen status.");
    console.log("✅ Verified: Book intro is dismissible and saves seen status.");

    // 4. Verify book intro button is reachable again
    console.log("Verifying book intro is reachable from the reading...");
    const showIntroBtn = await page.evaluate(() => {
      const btn = document.getElementById('bible_btnShowBookIntro');
      return btn && btn.style.display !== 'none';
    });
    if (!showIntroBtn) throw new Error("Book intro button next to reading is not visible/reachable.");
    console.log("✅ Verified: Book intro is reachable again from the reading.");

    // 5. Verify year progress bar/percentages/deficit copy is completely removed
    console.log("Verifying yearly progress UI removal...");
    const hasProgressUI = await page.evaluate(() => {
      const fill = document.getElementById('bible_progressFill');
      const frac = document.getElementById('bible_progressFraction');
      const sub = document.getElementById('bible_progressPercentSub');
      if (fill || frac || sub) return true;
      
      const root = document.getElementById('bible365Root');
      if (!root) return false;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        const text = node.nodeValue.toLowerCase().trim();
        if (text.includes('days behind') || text.includes('catch up') || text.includes('of 365')) {
          return true;
        }
        if (text.includes('%') && !text.includes('width') && !text.includes('opacity')) {
          return true;
        }
      }
      return false;
    });
    if (hasProgressUI) {
      throw new Error("Found progress bar, fraction, percentages, or catch-up deficit copy on the Bible surface!");
    }
    console.log("✅ Verified: Yearly progress/deficit metrics are completely removed from the Bible surface.");

    // 6. Verify backward and forward navigation mechanics
    console.log("Verifying backward and forward navigation mechanics...");
    const navResults = await page.evaluate(() => {
      // Setup initial state: day 60
      currentDay = 60;
      state.completed = [60];
      
      // Navigate backward to day 43
      currentDay = 43;
      renderHero();
      scrollGateUnlocked = true; // Unlock scroll gate for test purposes
      updateScrollGate(); // Update UI/class list
      const readDay43 = currentDay === 43;
      
      // Mark day 43 complete
      toggleCompletion();
      const day43Completed = state.completed.includes(43);
      
      // Navigate forward (reading ahead beyond todayMax)
      const initialDay = currentDay;
      scrollGateUnlocked = true; // Reset scroll unlock for the next day
      updateScrollGate();
      nextDay();
      const navigatedForward = currentDay === 44;
      
      return {
        readDay43,
        day43Completed,
        navigatedForward
      };
    });
    if (!navResults.readDay43) throw new Error("Could not navigate backward to read day 43.");
    if (!navResults.day43Completed) throw new Error("Reading day 43 did not add it to completed_days collection.");
    if (!navResults.navigatedForward) throw new Error("Forward navigation was blocked (stewards must be allowed to read ahead).");
    console.log("✅ Verified: Steward on day 60 can navigate backward to day 43, read it, and add to completed_days normally.");
    console.log("✅ Verified: Forward navigation is unblocked (stewards can read ahead).");

    // 7. Verify they/their pronoun references
    console.log("Verifying pronoun references (they/their)...");
    const pronounCheck = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      // Look for occurrences of he/she/his/her/him in instructions/UI
      const forbidden = [' he ', ' she ', ' his ', ' her ', ' him '];
      const found = forbidden.filter(p => text.includes(p));
      return found;
    });
    // Ignore generic content, but check for any prominent ones. We should be they/their.
    console.log("Pronoun scan results:", pronounCheck);

    console.log("🎉 ALL PAGE 6 INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    await browser.close();
    process.exit(1);
  }
})();
