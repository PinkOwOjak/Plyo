/**
 * Visual smoke test: drives the apps in a real browser and saves screenshots.
 *
 *   CHROME_PATH=/path/to/chrome node scripts/visual-check.mjs [webUrl] [mobileUrl] [outDir]
 *
 * Requires the dev servers to be running (npm run dev, npm run dev:mobile).
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const web = process.argv[2] ?? 'http://localhost:5173';
const mobile = process.argv[3] ?? 'http://localhost:5174';
const out = process.argv[4] ?? 'screenshots';
const only = process.env.ONLY ?? '';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
async function page(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${p.url()} ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(`${p.url()} ${m.text()}`));
  return p;
}
const seed = (p, extra = {}) =>
  p.evaluate((extra) => {
    localStorage.setItem('plyo.prefs.v2', JSON.stringify({ sound: false, motion: 'reduced', seenRules: true, ...extra }));
    localStorage.setItem('plyo.profile.v1', JSON.stringify({ name: 'Pranto' }));
  }, extra);

async function playBot(p, prefix, base) {
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${prefix}-toss.png` });
  await p.locator('button:has-text("Heads")').first().click();
  await p.waitForTimeout(1700);
  const bat = p.locator('button:has-text("Bat first")');
  if (await bat.count()) await bat.first().click();
  await p.waitForTimeout(3500);
  return base;
}

if (!only || only === 'web') {
  const p = await page({ width: 1440, height: 900 });
  await p.goto(web + '/#/');
  await seed(p);
  await p.reload();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/web-home.png`, fullPage: true });
  await p.goto(web + '/#/play/hand-cricket?mode=bot');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/web-setup.png`, fullPage: true });
  await p.click('button[role=radio]:has-text("Finger count")');
  await p.click('text=Start match');
  await playBot(p, 'web-match', web);
  await p.keyboard.press('1');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/web-match-six-preview.png` });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/web-match-reveal.png` });
  await p.goto(web + '/#/rules');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/web-rules.png`, fullPage: true });
  const m = await page({ width: 390, height: 844 });
  await m.goto(web + '/#/');
  await seed(m);
  await m.reload();
  await m.waitForTimeout(800);
  await m.screenshot({ path: `${out}/mweb-home.png` });
  await m.goto(web + '/#/match/bot?overs=2&rule=exact&difficulty=easy');
  await playBot(m, 'mweb-match', web);
  await m.screenshot({ path: `${out}/mweb-match.png` });
}

if (!only || only === 'mobile') {
  const touch = { isMobile: true, hasTouch: true };
  const p = await page({ width: 390, height: 844 }, touch);
  await p.goto(mobile + '/');
  await seed(p);
  await p.reload();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/app-home.png` });
  await p.tap('.feature');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/app-setup.png` });
  await p.tap('text=Start match');
  await p.waitForTimeout(2500);
  await p.locator('button:has-text("Heads")').first().tap();
  await p.waitForTimeout(1700);
  const bat = p.locator('button:has-text("Bat first")');
  if (await bat.count()) await bat.first().tap();
  await p.waitForTimeout(3500);
  // 01000 → 11000 → 10000: the six, previewed on your own hand.
  await p.tap('.pad--thumb');
  await p.tap('.pad--index');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/app-match-six.png` });
  await p.goto(mobile + '/#/play/duel?overs=1&rule=count&p2=Friend');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/app-duel.png` });
}

await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
