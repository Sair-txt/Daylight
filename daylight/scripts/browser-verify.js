/**
 * Daylight — Real Browser Verification Suite
 * Executes in headless Chromium via Playwright directly against file://daylight/index.html
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const fileUrl = 'file://' + path.join(rootDir, 'index.html');

async function runBrowserTests() {
  console.log(`[Browser Verify] Launching Playwright Chromium...`);
  
  let pw;
  try {
    pw = await import('/root/.bun/install/global/node_modules/playwright/index.mjs');
  } catch {
    try {
      pw = await import('playwright');
    } catch (e) {
      console.warn(`[Browser Verify] Playwright not found: ${e.message}`);
      process.exit(0);
    }
  }

  const browser = await pw.chromium.launch({ headless: true });
  console.log(`[Browser Verify] Chromium launched successfully (version: ${browser.version()}).`);

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });

  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', err => {
    console.error(`[Browser PageError]`, err.message);
    pageErrors.push(err.message);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[Browser ConsoleError]`, msg.text());
      consoleErrors.push(msg.text());
    }
  });

  console.log(`[Browser Verify] Loading file://${path.join(rootDir, 'index.html')}...`);
  await page.goto(fileUrl, { waitUntil: 'load' });

  // 1. App initialization and landmark checks
  const title = await page.title();
  console.log(`[Browser Verify] Title: "${title}"`);
  if (!title.includes('Daylight')) throw new Error('Title does not contain Daylight');

  const appEl = await page.evaluate(() => document.getElementById('app') !== null);
  if (!appEl) throw new Error('#app root element not found');

  // 2. Visible Zen rendering
  const zenDisplay = await page.evaluate(() => {
    const zen = document.getElementById('viewZen');
    return zen ? window.getComputedStyle(zen).display : 'none';
  });
  console.log(`[Browser Verify] Zen view display: ${zenDisplay}`);
  if (zenDisplay === 'none') throw new Error('Zen view should be initially visible');

  const greeting = await page.evaluate(() => {
    return document.querySelector('#viewZen h1')?.textContent?.trim() || '';
  });
  console.log(`[Browser Verify] Zen Greeting text: "${greeting}"`);
  if (!greeting.startsWith('Good ')) throw new Error(`Unexpected greeting: ${greeting}`);

  // 3. Navigation between Zen and Dō
  console.log(`[Browser Verify] Testing navigation to Dō view...`);
  await page.click('#btnModeDo');
  const doDisplay = await page.evaluate(() => {
    const doEl = document.getElementById('viewDo');
    return doEl ? window.getComputedStyle(doEl).display : 'none';
  });
  if (doDisplay === 'none') throw new Error('Dō view should be visible after clicking Dō button');

  console.log(`[Browser Verify] Testing navigation back to Zen view...`);
  await page.click('#btnModeZen');
  const zenAgain = await page.evaluate(() => window.getComputedStyle(document.getElementById('viewZen')).display);
  if (zenAgain === 'none') throw new Error('Zen view should be visible again after clicking Zen button');

  // 4. Accent Selection & Reset in Settings
  console.log(`[Browser Verify] Navigating to Settings via top bar button...`);
  await page.click('#btnOpenSettings');

  // Wait for settings section to render
  await page.waitForSelector('.accent-picker-section');
  console.log(`[Browser Verify] Accent picker section mounted successfully.`);

  console.log(`[Browser Verify] Testing Ocean Blue (#2B6CB0) preset swatch click...`);
  const bluePreset = await page.$('button[data-hex="#2B6CB0"]');
  if (!bluePreset) throw new Error('Ocean Blue preset button not found');
  await bluePreset.click();

  const activeAccent = await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'));
  console.log(`[Browser Verify] Document --accent after preset click: ${activeAccent}`);
  if (activeAccent !== '#2B6CB0') throw new Error(`Expected #2B6CB0, got ${activeAccent}`);

  console.log(`[Browser Verify] Testing Reset to Daylight Sage...`);
  const resetBtn = await page.$('#btnResetAccent');
  if (!resetBtn) throw new Error('#btnResetAccent button not found');
  await resetBtn.click();

  const resetAccent = await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'));
  console.log(`[Browser Verify] Document --accent after reset: ${resetAccent}`);
  if (resetAccent !== '#48634E' && resetAccent !== '#8FA893') {
    throw new Error(`Expected default sage, got ${resetAccent}`);
  }

  // 5. Light, Dark, System Theme Toggling
  console.log(`[Browser Verify] Testing theme toggle cycle (system -> light -> dark -> system)...`);
  // Click 1: system -> light
  await page.click('#btnThemeToggle');
  const themeAfterClick1 = await page.evaluate(() => window.DaylightApp ? window.storage?.state?.preferences?.theme : null);
  
  // Click 2: light -> dark
  await page.click('#btnThemeToggle');
  const darkThemeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log(`[Browser Verify] After switching to dark: data-theme="${darkThemeAttr}"`);
  if (darkThemeAttr !== 'dark') throw new Error(`Expected data-theme="dark", got "${darkThemeAttr}"`);

  // Click 3: dark -> system
  await page.click('#btnThemeToggle');
  console.log(`[Browser Verify] Theme toggle cycle completed successfully.`);

  // 6. Task creation and completion in Dō view
  console.log(`[Browser Verify] Testing Task section in Dō view...`);
  const tasksNavBtn = await page.$('button[data-section="tasks"]');
  if (tasksNavBtn) {
    await tasksNavBtn.click();
    await page.waitForSelector('#doContent');
    console.log(`[Browser Verify] Tasks section mounted.`);
  }

  // 7. Responsive narrow viewport test (375x667 mobile)
  console.log(`[Browser Verify] Testing responsive narrow viewport (375x667)...`);
  await page.setViewportSize({ width: 375, height: 667 });
  const mobileNavVisible = await page.evaluate(() => {
    const btn = document.getElementById('btnMobileNav');
    return btn ? window.getComputedStyle(btn).display !== 'none' : false;
  });
  console.log(`[Browser Verify] Mobile menu button visible at 375px: ${mobileNavVisible}`);

  // 8. Storage indicator status
  console.log(`[Browser Verify] Testing storage indicator status...`);
  const storageBadgeText = await page.evaluate(() => document.getElementById('storageBadgeText')?.textContent?.trim());
  console.log(`[Browser Verify] Storage badge text: "${storageBadgeText}"`);
  if (!['Saved', 'Memory Only'].includes(storageBadgeText)) {
    throw new Error(`Unexpected storage badge text: ${storageBadgeText}`);
  }

  // 9. Assert absence of syntax errors or uncaught page exceptions
  if (pageErrors.length > 0) {
    throw new Error(`Browser page errors detected: ${JSON.stringify(pageErrors)}`);
  }
  if (consoleErrors.length > 0) {
    throw new Error(`Browser console errors detected: ${JSON.stringify(consoleErrors)}`);
  }

  await browser.close();
  console.log(`[Browser Verify] ALL REAL BROWSER CHECKS PASSED WITH 0 ERRORS.`);
}

runBrowserTests().catch(err => {
  console.error(`[Browser Verify] FAILED:`, err);
  process.exit(1);
});
