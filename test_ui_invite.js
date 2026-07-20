const { chromium } = require('playwright');

console.log("=== RUNNING WHEALTHY INVITE PAGE TESTS ===");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Mock the Supabase affiliate endpoint
  await page.route('**/rest/v1/public_affiliates**', async route => {
    console.log("Mocking Supabase public_affiliates call");
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ name: 'Ignacio José' }])
    });
  });

  async function runTests() {
    // Navigate with ref parameter to test referrer pill personalization
    const targetUrl = 'http://localhost:12345/whealthy-command-center-repo/whealthy-invite.html?ref=ignacio';
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // 1. Verify Referrer Pill
    console.log("Checking referrer pill personalization...");
    await page.waitForSelector('.referrer-pill-dynamic', { state: 'visible', timeout: 3000 });
    const referrerText = await page.locator('.referrer-name').first().textContent();
    console.log(`Referrer name: ${referrerText}`);
    if (referrerText !== 'Ignacio José') {
      throw new Error(`Referrer name mismatch: expected "Ignacio José", got "${referrerText}"`);
    }

    // 2. Verify Hero title and Subtext
    console.log("Checking hero content...");
    const heroTitle = await page.locator('.hero__headline').textContent();
    if (!heroTitle.includes('You Carry Work, Family, and Faith.')) {
      throw new Error(`Hero title mismatch: ${heroTitle}`);
    }

    // 3. Verify 3-Stat Bar
    console.log("Checking 3-stat bar values...");
    const statValues = page.locator('.proof-stats__value');
    const val1 = await statValues.nth(0).textContent();
    const val2 = await statValues.nth(1).textContent();
    const val3 = await statValues.nth(2).textContent();
    console.log(`Stat values: ${val1} | ${val2} | ${val3}`);
    if (val1 !== 'FREE' || val2 !== '10% OFF' || val3 !== '73%') {
      throw new Error(`Stat bar values mismatch: ${val1} | ${val2} | ${val3}`);
    }

    // 4. Verify Quote Band
    console.log("Checking quote band quote...");
    const quoteText = await page.locator('.testimonial-band__quote').textContent();
    if (!quoteText.includes("I didn't feel hyped. I just felt clear.")) {
      throw new Error(`Quote band quote mismatch: ${quoteText}`);
    }
    const computedColor = await page.locator('.testimonial-band').evaluate(el => window.getComputedStyle(el).color);
    console.log(`Quote band computed color: ${computedColor}`);
    if (computedColor !== 'rgb(8, 8, 9)') {
      throw new Error(`Quote band color contrast issue: expected "rgb(8, 8, 9)", got "${computedColor}"`);
    }

    // 5. Verify Solution Numbered Moves
    console.log("Checking solution moves...");
    const movesCount = await page.locator('.solution-move').count();
    if (movesCount !== 3) {
      throw new Error(`Expected 3 solution moves, got ${movesCount}`);
    }
    const move1Title = await page.locator('.solution-move__title').nth(0).textContent();
    const move2Title = await page.locator('.solution-move__title').nth(1).textContent();
    const move3Title = await page.locator('.solution-move__title').nth(2).textContent();
    console.log(`Moves: ${move1Title} | ${move2Title} | ${move3Title}`);
    if (move1Title !== 'Join Free' || move2Title !== 'Name Your Pattern' || move3Title !== 'Govern Your Rhythm') {
      throw new Error(`Solution moves title mismatch: ${move1Title} | ${move2Title} | ${move3Title}`);
    }

    // 6. Verify Five Patterns
    console.log("Checking 5 pattern cards...");
    const patternCards = await page.locator('.pattern-card').count();
    // Testimonials also use the pattern-card class, so we should see (5 patterns + 4 testimonials) = 9 total pattern cards
    if (patternCards !== 9) {
      throw new Error(`Expected 9 total pattern cards on page, got ${patternCards}`);
    }

    // 7. Verify Tired vs Governed Split
    console.log("Checking split lists...");
    const splitTiredTitle = await page.locator('.split-list__title--tired').textContent();
    const splitGovTitle = await page.locator('.split-list__title--governed').textContent();
    if (!splitTiredTitle.includes("tired of") || !splitGovTitle.includes("Governed Rhythm")) {
      throw new Error(`Split list titles mismatch: ${splitTiredTitle} | ${splitGovTitle}`);
    }

    // 8. Verify Affiliate Rate Cards
    console.log("Checking affiliate rates...");
    const ratesValues = page.locator('.rate-card__value');
    const rate1 = await ratesValues.nth(0).textContent();
    const rate2 = await ratesValues.nth(1).textContent();
    console.log(`Rates: ${rate1} | ${rate2}`);
    if (rate1 !== '40%' || rate2 !== '30%') {
      throw new Error(`Rates values mismatch: ${rate1} | ${rate2}`);
    }

    // 9. Verify 4 Product Cards
    console.log("Checking product cards...");
    const productCards = await page.locator('.product-card').count();
    if (productCards !== 4) {
      throw new Error(`Expected 4 product cards, got ${productCards}`);
    }

    // 10. Verify Value Stack FREE Total
    console.log("Checking value stack...");
    const totalRow = await page.locator('.value-stack__row--total').textContent();
    console.log(`Value stack total row: ${totalRow}`);
    if (!totalRow.includes('Your price') || !totalRow.includes('FREE')) {
      throw new Error(`Value stack total mismatch: ${totalRow}`);
    }

    // 11. Verify FDA and disclaimers in footer
    console.log("Checking footer legal FDA disclaimers...");
    const footerText = await page.locator('footer').textContent();
    if (!footerText.includes('These statements have not been evaluated by the FDA.')) {
      throw new Error("Footer FDA disclaimer is missing or incorrect.");
    }

    // 12. Verify Sticky Bottom Bar on Scroll
    console.log("Verifying sticky bottom bar appearance on scroll...");
    const stickySelector = '#stickyCta';
    await page.waitForSelector(stickySelector, { state: 'attached', timeout: 3000 });
    
    const isInitiallyVisible = await page.locator(stickySelector).evaluate(el => el.classList.contains('sticky-bar--show'));
    if (isInitiallyVisible) {
      throw new Error("Sticky bar should not be visible before scrolling past quote band.");
    }

    // Scroll past quote band testimonial-band
    await page.evaluate(() => {
      const q = document.querySelector('.testimonial-band');
      const trigger = q.offsetTop + q.offsetHeight;
      window.scrollTo(0, trigger + 200);
    });
    await page.waitForTimeout(500);

    const isVisibleAfterScroll = await page.locator(stickySelector).evaluate(el => el.classList.contains('sticky-bar--show'));
    if (!isVisibleAfterScroll) {
      throw new Error("Sticky bar failed to show after scrolling past quote band.");
    }

    const stickyJoinBtn = await page.locator(`${stickySelector} button`).nth(0).textContent();
    const stickyLockBtn = await page.locator(`${stickySelector} button`).nth(1).textContent();
    console.log(`Sticky buttons: "${stickyJoinBtn}" | "${stickyLockBtn}"`);
    if (!stickyJoinBtn.includes('Join Free') || !stickyLockBtn.includes('Lock 40%')) {
      throw new Error(`Sticky buttons text mismatch: "${stickyJoinBtn}" | "${stickyLockBtn}"`);
    }

    console.log("✅ All invite page restructured layout items verified successfully!");
  }

  try {
    await runTests();
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error("Test execution failed:", e);
    await browser.close();
    process.exit(1);
  }
})();
