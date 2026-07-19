const { chromium } = require('playwright');

console.log("=== RUNNING QUIZ RESULTS PRICING TESTS ===");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  async function testPage(url) {
    console.log(`\n--- Testing URL: ${url} ---`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Directly render the results page for a specific recommendation bundle ('genius-joe')
    console.log("Rendering results page for 'genius-joe' bundle...");
    await page.evaluate(() => {
      // Mock global quiz variables that showFullResult relies on
      lastIdentity = {
        season: 'carrying',
        profile: {
          name: 'THE OPERATOR',
          carryLine: 'The decisions don\'t stop when the day does.',
          honor: 'Everyone\'s outcomes cross your desk...'
        },
        subtitle: {
          familyPhrase: 'Husband and Father',
          workPhrase: 'Managing Director'
        },
        citation: 'The responsibility'
      };
      lastContactInfo = { first_name: 'Ignacio' };
      
      // Render the results screen
      const resultObj = { key: 'morning-dependency', id: 'steward' };
      showFullResult(resultObj, 'genius-joe');
    });

    // 1. Verify S1 Hero has no stat bar regressions and is visible
    await page.waitForSelector('.s1-identity', { state: 'visible', timeout: 3000 });

    // 2. Verify NEW Proof Stat Bar (directly under S1)
    console.log("Checking proof stat bar...");
    const statsValueLocator = page.locator('.proof-stats__value');
    const stat1 = await statsValueLocator.nth(0).textContent();
    const stat2 = await statsValueLocator.nth(1).textContent();
    const stat3 = await statsValueLocator.nth(2).textContent();
    console.log(`Stats: Val1=${stat1}, Val2=${stat2}, Val3=${stat3}`);
    if (stat1 !== '$84.98') throw new Error("Incorrect retail value in stats: " + stat1);
    if (stat2 !== '$57.60/mo') throw new Error("Incorrect member price in stats: " + stat2);
    if (stat3 !== '$27.38') throw new Error("Incorrect difference value in stats: " + stat3);

    // 3. Verify testimonial band quote matching the archetype
    console.log("Checking testimonial band...");
    const testimonialQuote = await page.locator('.testimonial-band__quote').textContent();
    console.log("Testimonial: " + testimonialQuote);
    if (!testimonialQuote.includes("I didn't feel hyped. I just felt clear.")) {
      throw new Error("Testimonial quote mismatch: " + testimonialQuote);
    }

    // 4. Verify NEW price anchor line below S4 cost
    console.log("Checking price anchor below S4...");
    const anchorText = await page.locator('.price-anchor').textContent();
    console.log("Price anchor: " + anchorText);
    if (!anchorText.includes('$57.60/mo') || !anchorText.includes('$64.00 non-member')) {
      throw new Error("Price anchor text mismatch: " + anchorText);
    }

    // 5. Verify simplified results-price block (NO comparison rows)
    console.log("Checking simplified results-price block...");
    const rowsCount = await page.locator('.results-price__rows').count();
    if (rowsCount !== 0) {
      throw new Error("Simplified results pricing block should NOT contain comparison rows table.");
    }
    const heroPrice = await page.locator('.results-price__amount').textContent();
    if (heroPrice !== '$57.60') throw new Error("Incorrect simplified member hero price: " + heroPrice);

    // 6. Verify who it's for section exists
    console.log("Checking who-it's-for section...");
    const whoTitle = await page.locator('.who-its-for__title').textContent();
    if (whoTitle !== 'BUILT FOR THE ONES WHO CARRY') {
      throw new Error("Who it's for section missing or title mismatch: " + whoTitle);
    }

    // 7. Verify CTA buttons pricing updates in S7
    console.log("Checking S7 CTA buttons...");
    const buyButtonText = await page.locator('.s7-decision__path--quiet .s7-decision__btn').textContent();
    console.log("S7 Buy Button: " + buyButtonText);
    if (!buyButtonText.includes('Buy the Bundle · $64.00/mo')) {
      throw new Error("S7 Buy button price mismatch: " + buyButtonText);
    }

    const joinButtonText = await page.locator('.s7-decision__path--join .s7-decision__btn').textContent();
    console.log("S7 Join Button: " + joinButtonText);
    if (!joinButtonText.includes('Join Free · $57.60/mo · 10% off')) {
      throw new Error("S7 Join button price mismatch: " + joinButtonText);
    }

    // 8. Verify CTA buttons pricing updates in S9
    console.log("Checking S9 CTA buttons...");
    const s9JoinButton = await page.locator('.s9-final__buttons .btn-primary').textContent();
    console.log("S9 Join Button: " + s9JoinButton);
    if (!s9JoinButton.includes('Join Free · $57.60/mo · 10% off')) {
      throw new Error("S9 Join button price mismatch: " + s9JoinButton);
    }

    const s9BuyButton = await page.locator('.s9-final__buy-text').textContent();
    console.log("S9 Buy Button Link: " + s9BuyButton);
    if (!s9BuyButton.includes('Or buy The Genius Joe Routine now · $64.00/mo')) {
      throw new Error("S9 Buy button price mismatch: " + s9BuyButton);
    }

    // 9. Scroll past S2 and verify sticky bottom decision bar visibility and values
    console.log("Verifying sticky bottom bar scroll and prices...");
    const stickySelector = '#resultStickyBar';
    await page.waitForSelector(stickySelector, { state: 'attached', timeout: 3000 });
    
    // Initially sticky bar should not be visible (should not have class sticky-bar--show)
    const isInitiallyVisible = await page.locator(stickySelector).evaluate(el => el.classList.contains('sticky-bar--show'));
    if (isInitiallyVisible) {
      throw new Error("Sticky bar should not be shown before scrolling past S2.");
    }

    // Scroll past S2 dynamically and log values
    await page.evaluate(() => {
      const card = document.getElementById('quizCard');
      const s2 = card.querySelector('.s2-pattern');
      const trigger = s2.offsetTop + s2.offsetHeight;
      card.scrollTop = trigger + 500; // Scroll extra to be safe
      console.log(`SCROLL DEBUG: offsetTop=${s2.offsetTop}, offsetHeight=${s2.offsetHeight}, trigger=${trigger}, scrollTop=${card.scrollTop}`);
    });
    await page.waitForTimeout(500);

    const checkVisible = await page.locator(stickySelector).evaluate(el => ({
      classes: el.className,
      classList: Array.from(el.classList),
      display: window.getComputedStyle(el).display,
      bottom: window.getComputedStyle(el).bottom
    }));
    console.log("STICKY STATE:", JSON.stringify(checkVisible));

    const isShownAfterScroll = await page.locator(stickySelector).evaluate(el => el.classList.contains('sticky-bar--show'));
    if (!isShownAfterScroll) {
      throw new Error("Sticky bar failed to show after scroll past S2.");
    }

    const stickyBuyBtn = await page.locator(`${stickySelector} button`).nth(0).textContent();
    const stickyJoinBtn = await page.locator(`${stickySelector} button`).nth(1).textContent();
    console.log(`Sticky Buttons: Buy="${stickyBuyBtn}", Join="${stickyJoinBtn}"`);
    if (!stickyBuyBtn.includes('Buy the Bundle · $64.00/mo')) {
      throw new Error("Sticky Buy button price mismatch: " + stickyBuyBtn);
    }
    if (!stickyJoinBtn.includes('Join Free · $57.60/mo')) {
      throw new Error("Sticky Join button price mismatch: " + stickyJoinBtn);
    }

    console.log("✅ Verified: 'genius-joe' pricing and skeletal layout match spec.");

    // 10. Test Charge Powder bundle to verify review video section embeds (1 iframe + 1 placeholder)
    console.log("Testing review video section dynamically on 'charge' bundle...");
    await page.evaluate(() => {
      const resultObj = { key: 'energy-without-aim', id: 'steward' };
      showFullResult(resultObj, 'charge');
    });

    await page.waitForTimeout(300);

    const chargeRetail = await statsValueLocator.nth(0).textContent();
    const chargeMember = await statsValueLocator.nth(1).textContent();
    console.log(`Charge Stats: Retail=${chargeRetail}, Member=${chargeMember}`);
    if (chargeRetail !== '$84.98') throw new Error("Incorrect Charge retail price: " + chargeRetail);
    if (chargeMember !== '$54.00/mo') throw new Error("Incorrect Charge member price: " + chargeMember);

    // Verify 2 iframes and 0 placeholders
    const iframeCount = await page.locator('.review-videos__frame-wrap iframe').count();
    const placeholderCount = await page.locator('.review-videos__placeholder').count();
    console.log(`Video items: Iframe count=${iframeCount}, Placeholder count=${placeholderCount}`);
    if (iframeCount !== 2) throw new Error(`Expected exactly 2 YouTube review iframes, got ${iframeCount}`);
    if (placeholderCount !== 0) throw new Error(`Expected exactly 0 review placeholders, got ${placeholderCount}`);

    console.log("✅ Verified: 'charge' review section renders 2 video iframes + 0 placeholders correctly.");
  }

  try {
    await testPage('http://localhost:12345/whealthy-command-center-repo/whealthy-quiz.html');
    await testPage('http://localhost:12345/whealthy-command-center-repo/whealthy-home.html');

    console.log("\n=== ALL QUIZ RESULTS PRICING TESTS PASSED ===");
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error("Test failed:", e);
    await browser.close();
    process.exit(1);
  }
})();
