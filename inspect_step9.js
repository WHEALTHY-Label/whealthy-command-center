const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });
  
  // Set credentials and mock session
  await page.evaluate(() => {
    localStorage.setItem('wh_steward_email', 'whealthylabel@gmail.com');
    localStorage.setItem('wh_steward_name', 'Steward');
    localStorage.setItem('wh_claim_dismissed_month', new Date().toISOString().slice(0, 7));
  });
  
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // Navigate to Fast View
  await page.evaluate(() => {
    go('fast', document.getElementById('navFast'));
  });
  await page.waitForTimeout(500);
  
  // Go to step 9 directly by modifying W.step and rendering
  const step9HTML = await page.evaluate(() => {
    if (typeof W !== 'undefined') {
      W.step = 9;
      renderWizard();
      return document.getElementById('fastRoot').innerHTML;
    }
    return "W is undefined";
  });
  
  console.log("=== STEP 9 HTML ===");
  console.log(step9HTML);
  
  await browser.close();
})();
