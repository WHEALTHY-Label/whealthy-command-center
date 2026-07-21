const { chromium } = require('playwright');

(async () => {
  console.log("=== RUNNING RHYTHM UI REGRESSION TEST ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.message);
    process.exit(1);
  });

  // Load index.html locally
  await page.goto('http://localhost:12345/whealthy-command-center-repo/index.html', { waitUntil: 'networkidle' });

  // Set mock session state
  await page.evaluate(() => {
    window.MEMBER_EMAIL = 'whealthylabel@gmail.com';
    window.MEMBER_NAME = 'Steward';
    window.MEMBER_ID = 'test-id-123';
    localStorage.setItem('wh_steward_email', 'whealthylabel@gmail.com');
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Go to rhythm view
  await page.evaluate(() => {
    go('rhythm');
  });
  await page.waitForTimeout(500);

  // Transition to Threshold screen
  await page.evaluate(() => {
    window.RHYTHM_BUILDER.state.hasQuiz = false;
    window.RHYTHM_BUILDER.showScreen('Threshold');
  });

  const isThresholdVisible = await page.evaluate(() => {
    return document.getElementById('rhyScreenThreshold').classList.contains('active');
  });
  if (!isThresholdVisible) {
    console.error("FAIL: Threshold screen not active");
    process.exit(1);
  }
  console.log("PASS: Threshold screen is active");

  // Start assessment
  await page.evaluate(() => {
    window.RHYTHM_BUILDER.startAssessment();
  });

  const isAssessVisible = await page.evaluate(() => {
    return document.getElementById('rhyScreenAssess').classList.contains('active');
  });
  if (!isAssessVisible) {
    console.error("FAIL: Assessment screen not active");
    process.exit(1);
  }
  console.log("PASS: Assessment screen is active");

  // Step 1: select option
  await page.evaluate(() => {
    RHYTHM_BUILDER.setRmeq(0, 5, document.querySelector('#rhyScreenAssess .rhy-option'));
  });
  await page.evaluate(() => RHYTHM_BUILDER.nextStep());
  
  // Step 2
  await page.evaluate(() => {
    RHYTHM_BUILDER.setRmeq(1, 4, document.querySelector('#rhyScreenAssess .rhy-option'));
  });
  await page.evaluate(() => RHYTHM_BUILDER.nextStep());

  // Step 3
  await page.evaluate(() => {
    RHYTHM_BUILDER.setRmeq(2, 5, document.querySelector('#rhyScreenAssess .rhy-option'));
  });
  await page.evaluate(() => RHYTHM_BUILDER.nextStep());

  // Step 4
  await page.evaluate(() => {
    RHYTHM_BUILDER.setRmeq(3, 5, document.querySelector('#rhyScreenAssess .rhy-option'));
  });
  await page.evaluate(() => RHYTHM_BUILDER.nextStep());

  // Step 5
  await page.evaluate(() => {
    RHYTHM_BUILDER.setRmeq(4, 6, document.querySelector('#rhyScreenAssess .rhy-option'));
  });
  await page.evaluate(() => RHYTHM_BUILDER.nextStep());

  const indicatorText = await page.evaluate(() => {
    return document.getElementById('rhyStepIndicator').innerText;
  });
  if (!indicatorText.includes('Bedtime & Wake')) {
    console.error("FAIL: Step indicator not updated correctly:", indicatorText);
    process.exit(1);
  }
  console.log("PASS: Step indicator matches expected:", indicatorText);

  console.log("=== ALL RHYTHM UI REGRESSION TESTS PASSED ===");
  await browser.close();
  process.exit(0);
})();
