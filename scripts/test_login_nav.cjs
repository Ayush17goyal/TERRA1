const { chromium } = require('../node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

async function testLoginNav() {
  const userDataDir = path.resolve(__dirname, '../tmp/qa_browser_session');
  fs.mkdirSync(userDataDir, { recursive: true });
  
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1280, height: 800 }
  });
  
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  console.log('Navigating to http://localhost:5173/login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  console.log('Current URL:', page.url());
  const title = await page.title();
  console.log('Title:', title);

  const screenshotPath = path.resolve(__dirname, '../tmp/login_initial.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);
  
  const inputs = await page.$$eval('input', els => els.map(el => ({
    name: el.name,
    type: el.type,
    placeholder: el.placeholder,
    id: el.id,
    className: el.className
  })));
  console.log('Inputs found:', JSON.stringify(inputs, null, 2));
  
  const buttons = await page.$$eval('button', els => els.map(el => ({
    text: el.innerText.trim(),
    type: el.type,
    className: el.className
  })));
  console.log('Buttons found:', JSON.stringify(buttons, null, 2));

  await context.close();
}

testLoginNav().catch(err => {
  console.error('Error during testLoginNav:', err);
  process.exit(1);
});
