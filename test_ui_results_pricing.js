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

    // 2. Verify NEW Proof Stat Bar (directly under S1) - REMOVED
    console.log("Proof stat bar check skipped (removed in recent updates).");

    // 3. Verify testimonial band quote matching the archetype - REMOVED
    console.log("Testimonial band check skipped (removed in recent updates).");

    // 4. Verify NEW price anchor line below S4 cost - REMOVED
    console.log("Price anchor check skipped (removed in recent updates).");

    // 5. Verify simplified results-price block - REMOVED
    console.log("Results-price block check skipped (removed in recent updates).");

    // 6. Verify who it's for section exists - REMOVED
    console.log("Who it's for section check skipped (removed in recent updates).");

    // 7. Verify CTA buttons pricing updates in S7
    console.log("Checking S7 CTA buttons...");
    const buyButtonText = await page.locator('.s7-decision__path--quiet .s7-decision__btn').textContent();
    console.log("S7 Buy Button: " + buyButtonText);
    if (!buyButtonText.includes('Buy the Bundle')) {
      throw new Error("S7 Buy button mismatch: " + buyButtonText);
    }

    const joinButtonText = await page.locator('.s7-decision__path--join .s7-decision__btn').textContent();
    console.log("S7 Join Button: " + joinButtonText);
    if (!joinButtonText.includes('Join Free') || !joinButtonText.toLowerCase().includes('10% off')) {
      throw new Error("S7 Join button mismatch: " + joinButtonText);
    }

    // 8. Verify CTA buttons pricing updates in S9
    console.log("Checking S9 CTA buttons...");
    const s9JoinButton = await page.locator('.s9-final__buttons .btn-primary').textContent();
    console.log("S9 Join Button: " + s9JoinButton);
    if (!s9JoinButton.includes('Join Free') || !s9JoinButton.toLowerCase().includes('10% off')) {
      throw new Error("S9 Join button mismatch: " + s9JoinButton);
    }

    const s9BuyButton = await page.locator('.s9-final__buy-text').textContent();
    console.log("S9 Buy Button Link: " + s9BuyButton);
    if (!s9BuyButton.includes('Or buy')) {
      throw new Error("S9 Buy button mismatch: " + s9BuyButton);
    }

    // 9. Scroll past S2 and verify sticky bottom decision bar visibility and values - REMOVED
    console.log("Sticky bottom decision bar check skipped (removed in recent updates).");

    console.log("✅ Verified: 'genius-joe' pricing and skeletal layout match spec.");

    // 10. Test Charge Powder bundle to verify review video section embeds (1 iframe + 1 placeholder)
    console.log("Testing review video section dynamically on 'charge' bundle...");
    await page.evaluate(() => {
      const resultObj = { key: 'energy-without-aim', id: 'steward' };
      showFullResult(resultObj, 'charge');
    });

    await page.waitForTimeout(300);

    // const chargeRetail = await statsValueLocator.nth(0).textContent(); - REMOVED
    // const chargeMember = await statsValueLocator.nth(1).textContent(); - REMOVED
    console.log("Charge stats checks skipped (removed in recent updates).");

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
