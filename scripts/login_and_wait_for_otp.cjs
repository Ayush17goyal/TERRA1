const { chromium } = require('../node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

async function advanceToOtp() {
  const userDataDir = path.resolve(__dirname, '../tmp/qa_browser_session');
  fs.mkdirSync(userDataDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if contract popup is present and dismiss it if so
  const contractCheckbox = page.locator('#contract-accept-checkbox');
  if (await contractCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Contract popup detected. Accepting contract...');
    await contractCheckbox.check();
    const acceptBtn = page.locator('button:has-text("Accept & Continue")');
    if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // Find the email input
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Entering email: ayush.goyal2@s.amity.edu...');
  await emailInput.fill('ayush.goyal2@s.amity.edu');

  // Find and click the Sign In submit button
  const submitBtn = page.locator('button.custom-submit-btn, button[type="submit"]');
  console.log('Clicking Sign In submit button...');
  await submitBtn.click();

  // Wait for the verification code screen
  console.log('Waiting for OTP verification screen...');
  const otpInput = page.locator('input[placeholder="Enter 6-digit OTP"]');
  await otpInput.waitFor({ state: 'visible', timeout: 30000 });

  console.log('SUCCESS: OTP verification screen is visibly displayed!');
  const screenshotPath = path.resolve(__dirname, '../tmp/otp_screen.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot of OTP screen captured at:', screenshotPath);

  // Save the page storage state / cookies
  const statePath = path.resolve(__dirname, '../tmp/storageState.json');
  await context.storageState({ path: statePath });

  // Keep a local server or IPC ready to receive the OTP
  fs.writeFileSync(path.resolve(__dirname, '../tmp/otp_screen_ready.flag'), 'READY');

  // Let's create an OTP entry function script that will use this context or connect
  // We can keep the browser running or launch connected to Chrome CDP / persistent server
  return { browser, context, page };
}

// If run directly:
if (require.main === module) {
  advanceToOtp().then(async ({ browser, context, page }) => {
    console.log('Waiting for OTP input from user...');
    // We will poll for a file tmp/enter_otp.txt to enter it into this exact page
    const otpFlagFile = path.resolve(__dirname, '../tmp/enter_otp.txt');
    if (fs.existsSync(otpFlagFile)) fs.unlinkSync(otpFlagFile);

    const checkInterval = setInterval(async () => {
      if (fs.existsSync(otpFlagFile)) {
        clearInterval(checkInterval);
        const otpCode = fs.readFileSync(otpFlagFile, 'utf8').trim();
        console.log('Entering OTP code into page...');
        const otpInput = page.locator('input[placeholder="Enter 6-digit OTP"]');
        await otpInput.fill(otpCode);
        const verifyBtn = page.locator('button.custom-submit-btn:has-text("Verify")');
        await verifyBtn.click();
        console.log('Submitted OTP. Waiting for dashboard navigation...');
        try {
          await page.waitForURL('**/dashboard**', { timeout: 15000 });
          console.log('LOGIN_SUCCESS: Successfully navigated to', page.url());
          fs.writeFileSync(path.resolve(__dirname, '../tmp/login_success.flag'), 'SUCCESS');
          
          // Save storage state after login
          await context.storageState({ path: path.resolve(__dirname, '../tmp/auth_storage.json') });
        } catch (navErr) {
          console.error('Navigation after OTP timed out or failed:', navErr.message);
          const errBox = await page.locator('.error-alert-box').textContent().catch(() => '');
          console.error('Error on screen:', errBox);
          fs.writeFileSync(path.resolve(__dirname, '../tmp/login_error.txt'), errBox || navErr.message);
        } finally {
          // Clean up OTP flag file immediately (safety rule: never save or keep OTP)
          try { fs.unlinkSync(otpFlagFile); } catch {}
          await browser.close();
        }
      }
    }, 1000);
  }).catch(err => {
    console.error('Failed to reach OTP screen:', err);
    process.exit(1);
  });
}
