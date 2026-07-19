const { chromium } = require('playwright');

console.log("=== RUNNING SKOOL MEMBER TYPEAHEAD TESTS ===");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    // 1. Mock skool-member-search endpoint
    let searchPayload = null;
    await page.route('**/functions/v1/skool-member-search', async route => {
      searchPayload = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { handle: 'ignacio-zambrano', name: 'Ignacio Zambrano', avatar_url: 'https://example.com/avatar1.jpg' },
            { handle: 'ignacio-z', name: 'Ignacio Z', avatar_url: '' }
          ]
        })
      });
    });

    // 2. Mock skool-profile-lookup endpoint
    let lookupPayload = null;
    await page.route('**/functions/v1/skool-profile-lookup', async route => {
      lookupPayload = JSON.parse(route.request().postData());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          found: true,
          profile: {
            handle: 'new-steward',
            name: 'Brand New Steward',
            bio: 'Just joined the community',
            avatar_url: ''
          }
        })
      });
    });

    // Navigate to page
    console.log("Navigating to index.html locate screen...");
    await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });

    // Click to expand locate container/input if needed (the app opens locate screen by default if not signed in)
    await page.waitForSelector('#waHandle', { timeout: 5000 });

    // Type 2 characters to trigger search
    console.log("Typing 'ig' into handle input...");
    await page.fill('#waHandle', 'ig');
    await page.waitForTimeout(1000); // Wait for debounce

    // Verify search payload was captured
    if (!searchPayload) throw new Error("skool-member-search was not called.");
    if (searchPayload.q !== 'ig') throw new Error("Incorrect query sent: " + searchPayload.q);
    console.log("✅ Verified: Correct typeahead search payload sent.");

    // Verify option dropdown is visible and contains 2 candidates
    console.log("Verifying dropdown options...");
    await page.waitForSelector('#waSuggest.is-open', { state: 'visible', timeout: 5000 });
    
    const count = await page.locator('#waSuggest .wa-opt').count();
    console.log(`Found ${count} options in dropdown.`);
    if (count !== 2) throw new Error(`Expected 2 options, found: ${count}`);

    const name1 = await page.locator('#waSuggest .wa-opt:nth-child(1) .wa-opt__name').textContent();
    const handle2 = await page.locator('#waSuggest .wa-opt:nth-child(2) .wa-opt__handle').textContent();
    
    if (name1 !== 'Ignacio Zambrano') throw new Error("First option name mismatch: " + name1);
    if (handle2 !== '@ignacio-z') throw new Error("Second option handle mismatch: " + handle2);
    console.log("✅ Verified: Dropdown renders candidates correctly.");

    // Click the first candidate
    console.log("Clicking the first option...");
    await page.locator('#waSuggest .wa-opt:nth-child(1)').click();

    // Verify transition to found screen showing profile details
    console.log("Verifying screen found transition...");
    await page.waitForSelector('#waScreenFound', { state: 'visible', timeout: 3000 });
    const profileName = await page.locator('#waProfileName').textContent();
    const profileHandle = await page.locator('#waProfileHandle').textContent();

    if (profileName !== 'Ignacio Zambrano') throw new Error("Incorrect profile name shown: " + profileName);
    if (profileHandle !== '@ignacio-zambrano') throw new Error("Incorrect profile handle shown: " + profileHandle);
    console.log("✅ Verified: Candidate selection populates and transitions to the found profile screen.");

    // Go back to search to verify fallback explicit lookup
    console.log("Testing exact lookup fallback via button...");
    await page.click('#waNotMeBtn'); // Back to locate screen
    await page.waitForSelector('#waScreenLocate', { state: 'visible', timeout: 3000 });
    await page.waitForTimeout(200);

    // Type a full handle not in synced roster
    await page.fill('#waHandle', 'new-steward');
    await page.evaluate(() => document.getElementById('waFindBtn').click());

    // Verify lookup payload captured
    await page.waitForTimeout(1000);
    if (!lookupPayload) throw new Error("skool-profile-lookup was not called.");
    if (lookupPayload.handle !== 'new-steward') throw new Error("Incorrect lookup handle: " + lookupPayload.handle);

    // Verify transitions to found screen with exact profile
    await page.waitForSelector('#waScreenFound', { state: 'visible', timeout: 3000 });
    const fallbackName = await page.locator('#waProfileName').textContent();
    if (fallbackName !== 'Brand New Steward') throw new Error("Incorrect fallback profile name: " + fallbackName);
    console.log("✅ Verified: Exact-handle lookup fallback is working.");

    console.log("=== ALL SKOOL MEMBER TYPEAHEAD TESTS PASSED ===");
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error("Test failed:", e);
    await browser.close();
    process.exit(1);
  }
})();
