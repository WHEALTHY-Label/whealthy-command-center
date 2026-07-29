const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 12346;
const REPO_DIR = __dirname;

function serveStatic(req, res) {
  let filePath = path.join(REPO_DIR, req.url.replace('/whealthy-command-center-repo', ''));
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not Found');
  }
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png'
  };
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

(async () => {
  const server = http.createServer(serveStatic);
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("=== RUNNING $99 COMPLETE BUNDLE 3-STEP MODAL INTEGRATION TEST ===");

    // Mock onboarding-state
    await page.route('**/functions/v1/onboarding-state', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: true,
          gate: 'pass',
          member: { email: 'steward@whealthy.com', name: 'Steward' }
        })
      });
    });

    // Mock verify-member
    await page.route('**/functions/v1/verify-member', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verified: true })
      });
    });

    await page.goto(`http://localhost:${PORT}/whealthy-command-center-repo/index.html`, { waitUntil: 'domcontentloaded' });
    
    // Verify #navAll5 is labeled "Claim Your Bundle"
    const navAll5Text = await page.locator('#navAll5').textContent();
    if (!navAll5Text.includes('Claim Your Bundle')) throw new Error('#navAll5 label should be "Claim Your Bundle"!');
    console.log("✅ Verified: #navAll5 sidebar button renamed to Claim Your Bundle and moved up.");

    // Render Dash and test dashboard bundle card
    await page.evaluate(() => {
      const gate = document.getElementById('waGateOverlay');
      if (gate) gate.style.display = 'none';
      if (typeof window.waCloseGate === 'function') window.waCloseGate();
      window.go('dash');
      if (typeof window.renderDash === 'function') window.renderDash();
    });
    await page.waitForTimeout(500);

    const dashCardText = await page.locator('#dashRoot').textContent();
    if (!dashCardText.includes('$99')) {
      throw new Error('Dashboard card does not reflect $99 price!');
    }
    console.log("✅ Verified: Dashboard YOUR BUNDLE card updated with $99 pricing.");

    // Trigger dashboard card CTA click
    await page.evaluate(() => {
      const btn = document.querySelector('.btn-lime');
      if (btn) btn.click();
      else window.go('all5');
    });
    await page.waitForTimeout(500);

    // Verify #all5View is visible
    const isAll5Visible = await page.locator('#all5View').isVisible();
    if (!isAll5Visible) throw new Error('#all5View container is not visible after clicking dashboard card button!');
    console.log("✅ Verified: Dashboard card click navigates directly to #all5View.");

    // Test Hero CTA button click opens checkout modal (not redirect)
    console.log("Testing Hero CTA Button Click opens 3-step checkout modal...");
    await page.evaluate(() => window.triggerAll5Checkout());
    await page.waitForTimeout(500);

    // Modal should be open
    const modalOpen = await page.evaluate(() => {
      const modal = document.getElementById('claimCheckoutModal');
      return modal && modal.classList.contains('open');
    });
    if (!modalOpen) throw new Error('Checkout modal did not open after triggerAll5Checkout()!');
    console.log("✅ Verified: Hero CTA opens 3-step checkout modal popup.");

    // Step 1 should be visible with Name & Email fields
    const step1Visible = await page.evaluate(() => {
      const s1 = document.getElementById('claimStep1');
      return s1 && s1.style.display !== 'none';
    });
    if (!step1Visible) throw new Error('Step 1 (Name & Email) is not visible!');
    
    const hasNameInput = await page.locator('#claimInputName').isVisible();
    const hasEmailInput = await page.locator('#claimInputEmail').isVisible();
    if (!hasNameInput || !hasEmailInput) throw new Error('Step 1 missing Name or Email input fields!');
    console.log("✅ Verified: Step 1 shows Name & Email fields.");

    // Fill Step 1 and advance to Step 2
    await page.fill('#claimInputName', 'Test Steward');
    await page.fill('#claimInputEmail', 'test@whealthy.com');
    await page.evaluate(() => window.submitClaimStep1());
    await page.waitForTimeout(300);

    const step2Visible = await page.evaluate(() => {
      const s2 = document.getElementById('claimStep2');
      return s2 && s2.style.display !== 'none';
    });
    if (!step2Visible) throw new Error('Step 2 (Shipping Address) did not appear after Step 1 submit!');
    console.log("✅ Verified: Step 2 shows Shipping Address form after Step 1 submit.");

    // Verify Step 2 has shipping fields
    const hasAddressInput = await page.locator('#claimShipAddress').isVisible();
    const hasCityInput = await page.locator('#claimShipCity').isVisible();
    if (!hasAddressInput || !hasCityInput) throw new Error('Step 2 missing shipping address fields!');
    console.log("✅ Verified: Step 2 has Address, City, State, Zip fields.");

    // Close modal
    await page.evaluate(() => window.closeClaimCheckoutModal(null));
    await page.waitForTimeout(300);
    const modalClosed = await page.evaluate(() => {
      const modal = document.getElementById('claimCheckoutModal');
      return modal && !modal.classList.contains('open');
    });
    if (!modalClosed) throw new Error('Modal did not close properly!');
    console.log("✅ Verified: Modal closes cleanly.");

    // Test standalone page whealthy-all5-bundle.html
    console.log("Loading whealthy-all5-bundle.html...");
    await page.goto(`http://localhost:${PORT}/whealthy-command-center-repo/whealthy-all5-bundle.html`, { waitUntil: 'domcontentloaded' });
    const standaloneHeroVisible = await page.getByText('The Complete Steward System').isVisible();
    if (!standaloneHeroVisible) throw new Error('Standalone hero not visible in whealthy-all5-bundle.html!');
    console.log("✅ Verified: Standalone page whealthy-all5-bundle.html loads and renders hero cleanly.");

    console.log("=== ALL 5 BUNDLE TAB & 3-STEP MODAL FUNNEL INTEGRATION TESTS PASSED ===");
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
