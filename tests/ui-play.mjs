// Plays a whole game through the real screens in headless WebKit (iPhone size) or Chromium desktop,
// clicking buttons like a person would, and fails on any console error or page overflow.
//   node tests/ui-play.mjs <url> [--desktop] [--shots dir] [--n 4] [--games 1] [--reload]
// Needs playwright from ~/.claude/tools.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const args = process.argv.slice(2);
const url = args.find(a => a.startsWith('http')) || 'http://127.0.0.1:8614/';
const q = args.includes('--botms') ? '?botms=' + args[args.indexOf('--botms') + 1] : '';
const desktop = args.includes('--desktop');
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const n = args.includes('--n') ? +args[args.indexOf('--n') + 1] : 4;
const games = args.includes('--games') ? +args[args.indexOf('--games') + 1] : 1;
const reload = args.includes('--reload');
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

const browser = desktop ? await pw.chromium.launch() : await pw.webkit.launch();
const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 800 } } : { ...pw.devices['iPhone 15'], viewport: { width: 393, height: 659 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text() + (m.location() && m.location().url ? ' [' + m.location().url + ']' : '')); });
page.on('requestfailed', r => errs.push('request failed: ' + r.url() + ' ' + (r.failure() || {}).errorText));
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(url);
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(url + q + '#play');
// fast computers
await page.click('nav [data-tab="settings"]');
await page.click('[data-k="speed"][data-v="fast"]');
await page.click('nav [data-tab="play"]');
await page.click(`#seg-n [data-n="${n}"]`);
if (shots) await page.screenshot({ path: `${shots}/setup.png` });

const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1 || document.documentElement.scrollHeight > window.innerHeight + 1);

for (let g = 0; g < games; g++) {
  await page.click('#btn-new');
  await page.waitForSelector('#game');
  let steps = 0, took = {}, reloaded = false;
  for (;;) {
    if (++steps > 4000) fail('game did not end');
    const st = await page.evaluate(() => { const s = window.__kot.snap; return s && s.pub ? { over: s.pub.over, ask: s.pub.ask && s.toAct.includes(s.mySeat) ? s.pub.ask.type : null, turn: s.pub.turnNo } : null; });
    if (!st) { await page.waitForTimeout(100); continue; }
    if (st.over) break;
    if (reload && !reloaded && st.turn >= 6) { reloaded = true; await page.reload(); await page.click('#btn-resume'); await page.waitForSelector('#game'); console.log('reloaded mid-game and resumed'); continue; }
    if (!st.ask) { await page.waitForTimeout(60); continue; }
    if (!took[st.ask] && shots) { took[st.ask] = 1; await page.waitForTimeout(450); await shot('ask-' + st.ask); }
    if (await overflow()) fail('page overflows on ' + st.ask);
    const sheet = await page.$('#sheet');
    if (sheet && !['ray', 'mimic'].includes(st.ask)) { await page.click('#sheet .sheet-back, #sheet', { position: { x: 5, y: 5 } }).catch(() => {}); }
    switch (st.ask) {
      case 'start': await page.click('#btn-roll'); break;
      case 'roll': {
        // follow the green hint dots: keep exactly the hinted dice
        const dice = await page.$$eval('[data-die]', els => els.map(e => ({ kept: e.classList.contains('kept'), hint: e.classList.contains('hint') })));
        const canReroll = await page.$eval('#btn-reroll', b => !b.disabled).catch(() => false);
        const wantKeepAll = dice.every(d => d.hint);
        if (process.env.KOT_DEBUG) console.log('roll', JSON.stringify(dice), canReroll, await page.evaluate(() => [window.__kotRenders, JSON.stringify(window.__kot.snap.pub.t), !!document.querySelector('#sheet')]));
        if (!canReroll || wantKeepAll) { await page.click('#btn-done', { timeout: 1500 }).catch(() => {}); break; }
        for (let k = 0; k < dice.length; k++) if (dice[k].kept !== dice[k].hint) await page.click(`[data-die="${k}"]`);
        const ok = await page.$eval('#btn-reroll', b => !b.disabled).catch(() => false);
        await page.click(ok ? '#btn-reroll' : '#btn-done', { timeout: 1500 }).catch(() => {});
        break;
      }
      case 'yield': await page.click(Math.random() < 0.5 ? '#btn-stay' : '#btn-leave'); break;
      case 'wings': await page.click('#btn-wings'); break;
      case 'probe': await page.click('#btn-pass'); break;
      case 'opp': await page.click('#btn-pass'); break;
      case 'ray': await page.waitForSelector('#btn-rayok'); await page.click('#btn-rayok'); break;
      case 'mimic': await page.waitForSelector('#sheet [data-k]'); await page.click('#sheet [data-k]'); break;
      case 'buy': {
        // buy the first affordable card once in a while, through the card sheet
        const can = await page.$$('[data-slot].can');
        if (can.length && Math.random() < 0.6) {
          await can[0].click();
          await page.waitForSelector('#sheet');
          if (!took.card && shots) { took.card = 1; await shot('card-sheet'); }
          const b = await page.$('#btn-buy:not([disabled])');
          if (b) { await b.click(); break; }
          await page.click('#btn-x');
        }
        await page.click('#btn-end');
        const m = await page.$('#btn-endm'); if (m) await m.click();
        break;
      }
      default: fail('unknown ask ' + st.ask);
    }
    await page.waitForTimeout(40);
  }
  const tEnd = Date.now();
  let endOk = false;
  while (Date.now() - tEnd < 15000) { if (await page.evaluate(() => !!document.querySelector('#sheet .endcard'))) { endOk = true; break; } await page.waitForTimeout(100); }
  const endMs = Date.now() - tEnd;
  if (endOk && !(await page.isVisible('#sheet .endcard'))) fail('end screen in the page but not visible');
  if (!endOk) {
    await page.screenshot({ path: (shots || '.') + '/noend.png' });
    fail('no end screen: ' + JSON.stringify(await page.evaluate(() => ({ sheet: document.querySelector('#sheet') ? document.querySelector('#sheet').innerText.slice(0, 160) : null, why: window.__kot.snap.pub.why, w: window.__kot.snap.pub.winners }))));
  }
  await shot('end' + g);
  const res = await page.evaluate(() => { const p = window.__kot.snap.pub; return { winners: p.winners.map(i => p.players[i].name), turn: p.turnNo, why: p.why }; });
  console.log('game', g + 1, 'over:', JSON.stringify(res), 'end screen after', endMs, 'ms');
  await page.click('#btn-again2');
  await page.waitForSelector('#btn-new');
}
if (errs.length) fail('console errors:\n' + errs.join('\n'));
console.log('PASS ' + games + ' game(s) played through the screens, no console errors, no overflow (' + (desktop ? 'Chromium 1280' : 'WebKit 393') + ')');
await browser.close();
