const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });
  
  const step9HTML = await page.evaluate(() => {
    // Force wizard state to step 9
    window.W = window.W || {};
    window.W.step = 9;
    window.W.carried = 'alone';
    window.renderWizard();
    return document.getElementById('fastRoot').innerHTML;
  });
  
  console.log("=== STEP 9 HTML ===");
  console.log(step9HTML);
  
  await browser.close();
})();
