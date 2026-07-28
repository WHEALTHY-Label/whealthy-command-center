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
    console.log("=== RUNNING $99 COMPLETE BUNDLE TAB INTEGRATION TEST ===");

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
    
    // Close gate overlay if present and navigate to all5
    await page.evaluate(async () => {
      const gate = document.getElementById('waGateOverlay');
      if (gate) gate.style.display = 'none';
      if (typeof window.waCloseGate === 'function') window.waCloseGate();
      
      const btn = document.getElementById('navAll5');
      if (btn) window.go('all5', btn);
      else window.go('all5');
    });
    await page.waitForTimeout(500);

    // Verify #all5View is visible
    const isAll5Visible = await page.locator('#all5View').isVisible();
    if (!isAll5Visible) throw new Error('#all5View container is not visible after clicking navAll5!');
    console.log("✅ Verified: #all5View is visible upon navigation.");

    // Verify header line text
    const headerLineText = await page.locator('#headerLine').textContent();
    if (!headerLineText.includes('$99 Complete Bundle')) {
      throw new Error(`Header line text mismatch: ${headerLineText}`);
    }
    console.log(`✅ Verified: Header line text is "${headerLineText}".`);

    // Verify all 5 product card titles are rendered
    const cardTitles = ['Genius Guice', 'Genius Joe', 'WHEALTHY Hydration', 'Charge', 'Boss'];
    for (const title of cardTitles) {
      const cardExists = await page.locator('#all5View').getByText(title, { exact: true }).count() > 0;
      if (!cardExists) throw new Error(`Product card title "${title}" not found inside #all5View!`);
    }
    console.log("✅ Verified: All 5 product cards are rendered inside #all5View.");

    // Verify Protocol Section
    const protocolVisible = await page.locator('#all5View').getByText('The 24-Hour Steward Daily Protocol').isVisible();
    if (!protocolVisible) throw new Error('24-Hour Protocol section not visible!');
    console.log("✅ Verified: 24-Hour Steward Daily Protocol section rendered.");

    // Test standalone page whealthy-all5-bundle.html
    console.log("Loading whealthy-all5-bundle.html...");
    await page.goto(`http://localhost:${PORT}/whealthy-command-center-repo/whealthy-all5-bundle.html`, { waitUntil: 'domcontentloaded' });
    const standaloneHeroVisible = await page.getByText('The Complete Steward System').isVisible();
    if (!standaloneHeroVisible) throw new Error('Standalone hero not visible in whealthy-all5-bundle.html!');
    console.log("✅ Verified: Standalone page whealthy-all5-bundle.html loads and renders hero cleanly.");

    console.log("=== ALL 5 BUNDLE TAB INTEGRATION TESTS PASSED ===");
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
