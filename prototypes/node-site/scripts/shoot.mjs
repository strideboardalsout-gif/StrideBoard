// Screenshots of the prototype with a throwaway demo database (fake data only).
// Covers phone and desktop layouts, the iPhone "glass" look and dark mode.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const { chromium, devices } = createRequire(import.meta.url)('/opt/npm-tools/node_modules/playwright/index.js');

const out = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const port = 3917;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['src/server.js'], {
  env: { ...process.env, PORT: String(port), DEMO_DATA: '1' }, stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((r) => server.stdout.once('data', r));

const SETTLE_MS = 1600; // let the intro animations (ring, blocks, bars) finish

async function logIn(page) {
  await page.goto(base + '/login');
  await page.fill('#username', 'demo');
  await page.fill('#pin', '1234');
  await page.click('button[type=submit]');
  await page.waitForURL('**/home');
}

// Grow the window to the page's full height before the shot, so the pinned tab bar
// sits at the bottom (a plain full-page capture paints it halfway down, over the cards).
async function shot(page, name) {
  await page.waitForTimeout(SETTLE_MS);
  const before = page.viewportSize();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: before.width, height: Math.max(height, before.height) });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + name });
  await page.setViewportSize(before);   // the next page is measured at the normal size
}

const browser = await chromium.launch();
try {
  // Phone (Android-style browser): login, Home with 3 glasses of water added in place, Log.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto(base + '/login');
    await shot(page, 'phone-login.png');
    await logIn(page);
    for (let i = 0; i < 3; i++) {
      await page.click('[data-water-change="plus"]');
      await page.waitForFunction((n) => document.querySelector('[data-water-count]').textContent === String(n), i + 1);
    }
    await shot(page, 'phone-home.png');
    await page.goto(base + '/log');
    await shot(page, 'phone-log.png');
    await ctx.close();
  }
  // iPhone: the site switches to its frosted "glass" look on Apple devices.
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    await logIn(page);
    await shot(page, 'iphone-home-glass.png');
    await ctx.close();
  }
  // Dark mode on a phone.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await logIn(page);
    await shot(page, 'phone-home-dark.png');
    await ctx.close();
  }
  // Desktop: side nav and three-column grid.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const page = await ctx.newPage();
    await logIn(page);
    await shot(page, 'desktop-home.png');
    await page.goto(base + '/log');
    await shot(page, 'desktop-log.png');
    await ctx.close();
  }
  console.log('screenshots written to', out);
} finally {
  await browser.close();
  server.kill();
}
