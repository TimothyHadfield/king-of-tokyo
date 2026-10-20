// Regression checks for the 2026-10-20 QA findings, in headless WebKit at iPhone size.
//   node tests/ui-fixes.mjs [url] [--online]
// --online also checks the lobby's monsters (creates a real room on the shared free Firebase project).
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const args = process.argv.slice(2);
const url = (args.find(a => a.startsWith('http')) || 'http://127.0.0.1:8614/').replace(/[#?].*$/, '');
const online = args.includes('--online');
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

const browser = await pw.webkit.launch();
const ctx = await browser.newContext({ ...pw.devices['iPhone 15'], viewport: { width: 393, height: 659 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

const fresh = async (store) => {
  await page.goto(url + '#play');
  await page.evaluate(s => { try { localStorage.clear(); if (s) localStorage.setItem('kot-lab-v1', JSON.stringify(s)); } catch (e) {} }, store || null);
  await page.goto(url + '?botms=30#play');
  await page.reload();
  await page.waitForSelector('#seg-n');
};
const snapInfo = () => page.evaluate(() => { const s = window.__kot.snap; return s && s.pub ? { ask: s.pub.ask && s.toAct.includes(s.mySeat) ? s.pub.ask.type : null, rerolls: s.pub.t ? s.pub.t.rerolls : null, turn: s.pub.turnNo, mine: s.pub.t && s.pub.t.seat === s.mySeat } : null; });
const waitAsk = async (want, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await snapInfo();
    if (s && s.ask === want) return s;
    // play through other decisions quickly so we get back to our own turn start
    if (s && s.ask && s.ask !== want) await page.evaluate(() => { const s = window.__kot.snap; window.__kot.act(window.KotBots.decide(s.pub, s.mySeat, 'medium', Math.random, s.mine || {})); });
    await page.waitForTimeout(80);
  }
  throw new Error('never asked ' + want);
};
const center = async sel => { const b = await page.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

// 1. double tap on Roll must roll once (not roll + reroll); double tap on Reroll must spend one reroll
await fresh();
await page.click('#seg-n [data-n="2"]');
await page.click('#btn-new');
await page.waitForSelector('#game');
let rollOk = true, rerollOk = true, seenRoll = 0, seenReroll = 0;
for (let k = 0; k < 4; k++) {
  await waitAsk('start');
  // two finger taps 120 ms apart on the same spot (a nervous double tap)
  const [x, y] = await center('#btn-roll');
  await page.touchscreen.tap(x, y); await page.waitForTimeout(120); await page.touchscreen.tap(x, y);
  await page.waitForTimeout(300);
  let s = await snapInfo();
  if (s.ask === 'roll') { seenRoll++; if (s.rerolls !== 2) rollOk = false; }
  if (s.ask === 'roll' && s.rerolls === 2) {
    await page.waitForTimeout(450);
    const [rx, ry] = await center('#btn-reroll');
    if (k % 2) await page.mouse.dblclick(rx, ry);
    else { await page.touchscreen.tap(rx, ry); await page.waitForTimeout(120); await page.touchscreen.tap(rx, ry); }
    await page.waitForTimeout(300);
    s = await snapInfo();
    if (s.ask === 'roll') { seenReroll++; if (s.rerolls !== 1) rerollOk = false; }
  }
  // finish this turn
  await page.evaluate(() => { const s = window.__kot.snap; if (s.pub.ask && s.toAct.includes(s.mySeat) && s.pub.ask.type === 'roll') window.__kot.act({ t: 'done' }); });
}
check(rollOk && seenRoll >= 2, 'a double tap on Roll rolls once (2 rerolls left), ' + seenRoll + ' tries');
check(rerollOk && seenReroll >= 2, 'a double tap / double-click on Reroll spends one reroll, ' + seenReroll + ' tries');

// 2. kept dice survive a reload
await waitAsk('start');
await page.click('#btn-roll');
await waitAsk('roll');
await page.waitForTimeout(450);
const before = await page.$$eval('[data-die]', els => els.map(e => e.classList.contains('kept')));
const pick = before.findIndex(k => !k);
await page.click(`[data-die="${pick}"]`);
const raised = await page.$$eval('[data-die]', els => els.map(e => e.classList.contains('kept')));
await page.reload();
await page.click('#btn-resume');
await page.waitForSelector('#game');
await page.waitForTimeout(300);
const after = await page.$$eval('[data-die]', els => els.map(e => e.classList.contains('kept')));
check(JSON.stringify(after) === JSON.stringify(raised) && raised[pick], 'kept dice come back after a reload ' + JSON.stringify([raised, after]));

// 3. Back with a sheet open only closes the sheet
await page.click('nav [data-tab="cards"]');
await page.click('nav [data-tab="play"]');
await page.waitForSelector('#game');
await page.click('#btn-log');
await page.waitForSelector('#sheet');
await page.goBack();
await page.waitForTimeout(300);
const back = await page.evaluate(() => ({ sheet: !!document.getElementById('sheet'), hash: location.hash, play: document.getElementById('v-play').classList.contains('on') }));
check(!back.sheet && back.hash === '#play' && back.play, 'Back closes the sheet and stays on #play ' + JSON.stringify(back));

// 4. an error message shows once
await page.evaluate(() => { window.__toasts = 0; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('toast')) window.__toasts++; }))).observe(document.body, { childList: true }); });
await page.evaluate(() => window.__kot.act({ t: 'nonsense' }));
await page.waitForTimeout(200);
check(await page.evaluate(() => window.__toasts) === 1, 'an illegal move shows its message once');

// 5. a broken save: Resume says so and clears it
await fresh({ saved: { state: { players: 'x' }, kinds: ['human', 'computer'] } });
await page.click('#btn-resume');
await page.waitForTimeout(300);
const broken = await page.evaluate(() => ({ toast: (document.querySelector('.toast') || {}).textContent || '', resume: !!document.getElementById('btn-resume'), start: !!document.getElementById('btn-new'), saved: JSON.parse(localStorage.getItem('kot-lab-v1')).saved }));
check(/restore/.test(broken.toast) && !broken.resume && broken.start && !broken.saved, 'a broken save shows "Couldn’t restore" and is cleared ' + JSON.stringify(broken));
await page.click('#btn-new');
await page.waitForSelector('#game');
check(true, 'a new game starts after the broken save');

// 6. 6 monsters: Join is above the fold
await fresh();
await page.click('#seg-n [data-n="6"]');
const jb = await page.locator('#btn-join').boundingBox();
const navTop = (await page.locator('nav.tabs').boundingBox()).y;
check(jb.y + jb.height <= navTop, 'Join is visible above the tab bar with 6 monsters (bottom ' + Math.round(jb.y + jb.height) + ' px, tab bar at ' + Math.round(navTop) + ')');
// room code box keeps a 5-letter code typed with a space
await page.fill('#in-code', 'ab cd e');
check((await page.inputValue('#in-code')) === 'ab cd e', 'the code box takes "ab cd e"');

// 7. 2-player variant switch is off and disabled on the 2011 deck
await page.click('nav [data-tab="settings"]');
await page.click('[data-k="edition"][data-v="2011"]');
const duel = await page.evaluate(() => { const i = document.querySelector('[data-sw="duel"]'); return { disabled: i.disabled, checked: i.checked }; });
check(duel.disabled && !duel.checked, '2-player variant is disabled on the 2011 deck');
await page.click('[data-k="edition"][data-v="2016"]');
check(!(await page.evaluate(() => document.querySelector('[data-sw="duel"]').disabled)), '2-player variant works again on the 2016 deck');

// 8. Odds tab at 0 rerolls never shows a negative worth
await page.click('nav [data-tab="odds"]');
await page.click('[data-r="0"]');
const oddsTxt = await page.evaluate(() => [...document.querySelectorAll('#v-odds .row.small')].map(r => r.textContent).join(' | '));
check(!/−|-\d/.test(oddsTxt) && /These dice are worth/.test(oddsTxt), 'Odds tab at 0 rerolls: ' + oddsTxt);

// 9. lobby shows the picked monsters (online)
if (online) {
  await page.click('nav [data-tab="play"]');
  await page.click('#seg-n [data-n="2"]');
  await page.click('[data-mon-pick="0"]'); await page.click('[data-mon-pick="0"]');
  const picked = await page.evaluate(() => JSON.parse(localStorage.getItem('kot-lab-v1')).settings.mons);
  await page.fill('#in-name', 'QA');
  await page.click('#btn-create');
  await page.waitForFunction(() => document.querySelector('.code-big') && document.querySelector('.code-big').textContent.trim().length === 5, null, { timeout: 25000 });
  const same = await page.evaluate(() => [...document.querySelectorAll('.seatrow')].map(r => r.querySelector('svg').outerHTML));
  const want = await page.evaluate(m => m.map(x => { const d = document.createElement('div'); d.innerHTML = window.KotArt.monster(x, 30); return d.firstElementChild.outerHTML; }), picked);
  check(want[0] && JSON.stringify(same) === JSON.stringify(want), 'lobby shows the picked monsters ' + JSON.stringify(picked));
  await page.click('#btn-leave');
}

const real = errs.filter(e => !/firestore|Firestore/.test(e));
check(!real.length, 'no console errors ' + JSON.stringify(real));
await browser.close();
console.log(failed ? failed + ' check(s) FAILED' : 'ALL PASS');
process.exit(failed ? 1 : 0);
