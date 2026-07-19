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

    // 1. Verify results-price block visibility and values
    console.log("Checking price block elements...");
    await page.waitForSelector('.results-price', { state: 'visible', timeout: 3000 });

    const heroPrice = await page.locator('.results-price__amount').textContent();
    console.log("Member Hero Price: " + heroPrice);
    if (heroPrice !== '$57.60') throw new Error("Incorrect member hero price: " + heroPrice);

    const nonMemberPrice = await page.locator('.results-price__strike').first().textContent();
    console.log("Non-member price (struck): " + nonMemberPrice);
    if (nonMemberPrice !== '$64.00/mo') throw new Error("Incorrect non-member strike price: " + nonMemberPrice);

    // 2. Verify CTA buttons pricing updates in S7
    console.log("Checking S7 CTA buttons...");
    const buyButtonText = await page.locator('.s7-decision__path--quiet .s7-decision__btn').textContent();
    console.log("Buy Button: " + buyButtonText);
    if (!buyButtonText.includes('Buy the Bundle · $64.00/mo')) {
      throw new Error("S7 Buy button price mismatch: " + buyButtonText);
    }

    const joinButtonText = await page.locator('.s7-decision__path--join .s7-decision__btn').textContent();
    console.log("Join Button: " + joinButtonText);
    if (!joinButtonText.includes('Join Free · $57.60/mo · 10% off')) {
      throw new Error("S7 Join button price mismatch: " + joinButtonText);
    }

    // 3. Verify CTA buttons pricing updates in S9
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

    console.log("✅ Verified: 'genius-joe' pricing values match the source of truth.");

    // Now switch and render another bundle to verify dynamic updates ('boss')
    console.log("Testing dynamic pricing update with 'boss' bundle...");
    await page.evaluate(() => {
      const resultObj = { key: 'holding-it-together', id: 'steward' };
      showFullResult(resultObj, 'boss');
    });

    await page.waitForTimeout(200);

    const bossHeroPrice = await page.locator('.results-price__amount').textContent();
    console.log("Boss Member Hero Price: " + bossHeroPrice);
    if (bossHeroPrice !== '$49.50') throw new Error("Incorrect boss member hero price: " + bossHeroPrice);

    const bossBuyButton = await page.locator('.s7-decision__path--quiet .s7-decision__btn').textContent();
    console.log("Boss Buy Button: " + bossBuyButton);
    if (!bossBuyButton.includes('Buy the Bundle · $55.00/mo')) {
      throw new Error("Boss S7 Buy button price mismatch: " + bossBuyButton);
    }

    console.log("✅ Verified: 'boss' pricing values match the source of truth.");
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
