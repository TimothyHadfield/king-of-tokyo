// Odd situations on the real screens (2026-10-20 edge pass), headless WebKit unless --desktop.
//   node tests/edge-ui.mjs <url> [--shots dir]
// Each case builds a game state with the engine, saves it the way the app does, reloads and resumes,
// then checks the screen: no console errors, no sideways scroll, the main button on screen.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const args = process.argv.slice(2);
const url = (args.find(a => a.startsWith('http')) || 'http://127.0.0.1:8614/').replace(/[#?].*$/, '');
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

const browser = await pw.webkit.launch();
const SIZES = { phone: { width: 393, height: 659 }, se: { width: 320, height: 568 }, land: { width: 659, height: 393 } };
async function newPage(size) {
  const ctx = await browser.newContext({ ...pw.devices['iPhone 15'], viewport: SIZES[size] || SIZES.phone });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errs.push(m.text()); });
  await page.goto(url + '?botms=40#play');
  return page;
}
// build a state in the page with the real engine, then let `mod` change it
async function resumeWith(page, n, kinds, modSrc, settings) {
  await page.evaluate(({ n, kinds, modSrc, settings }) => {
    const rng = Math.random;
    const names = ['Supercalifragilistic', '🦖🔥 Rex 🔥🦖', 'Ana', 'Bo', 'Wolfeschlegelstein', 'Ana'];
    const seats = kinds.map((k, i) => ({ kind: k, name: k === 'human' ? (i ? 'Player ' + (i + 1) : 'You') : 'Computer' }));
    let s = window.KotEngine.setup(n, { edition: '2016', bay: true }, rng, seats);
    // eslint-disable-next-line no-new-func
    s = new Function('s', 'E', 'names', modSrc + '; return s;')(s, window.KotEngine, names);
    localStorage.setItem('kot-lab-v1', JSON.stringify({ settings: Object.assign({ kinds, speed: 'fast' }, settings || {}), saved: { state: s, kinds } }));
  }, { n, kinds, modSrc, settings });
  await page.reload();
  await page.click('#btn-resume');
  await page.waitForSelector('#game');
  await page.waitForTimeout(500);
}
const layout = page => page.evaluate(() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const btn = document.querySelector('#v-play .acts .btn');
  const r = btn ? btn.getBoundingClientRect() : null;
  return { over: document.documentElement.scrollWidth > vw + 1, btnOn: !!r && r.bottom <= vh + 1 && r.top >= 0 && r.width > 20, btn: btn ? btn.textContent.trim() : '' };
});
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

// 1. discard pile after a reload shows the real cards (it is face up on the table)
{
  const page = await newPage('phone');
  await resumeWith(page, 4, ['human', 'computer', 'computer', 'computer'], "s.discard = ['heal','tanks','energize','skyscraper','corner-store']");
  const pile = await page.evaluate(() => ({ blank: document.querySelectorAll('#dpile .pc.used').length, names: [...document.querySelectorAll('#dpile .pc .nm')].map(e => e.textContent) }));
  check(pile.blank === 0 && pile.names.length === 4, 'discard pile after a reload shows its top cards face up ' + JSON.stringify(pile));
  await shot(page, 'discard-reload');
  check(!page.errs.length, 'discard case: no console errors ' + JSON.stringify(page.errs));
  await page.context().close();
}

// 2. six monsters, long / emoji / duplicate names, 20 keep cards in front of me, 15 in front of a rival, at three sizes
const crowd = `s.players.forEach((p, i) => { if (i) p.name = names[i]; });
  const keeps = Object.keys(window.KotCards.BY_ED['2016']).filter(id => window.KotCards.BY_ED['2016'][id].keep && id !== 'mimic' && id !== 'it-has-a-child');
  s.players[0].cards = keeps.slice(0, 20).map(id => ({ id, k: s.nextK++ }));
  s.players[2].cards = keeps.slice(20, 35).map(id => ({ id, k: s.nextK++ }));
  s.players[1].vp = 19; s.players[3].en = 188; s.players[4].hp = 1; s.players[5].poison = 3; s.players[5].shrink = 2;`;
for (const size of ['phone', 'se', 'land']) {
  const page = await newPage(size);
  await resumeWith(page, 6, ['human', 'computer', 'computer', 'computer', 'computer', 'computer'], crowd + " s.q = []; s.ask = null; s.cur = 0; s.q.push({ op: 'turn', seat: 0, less: 0 }); E.run(s, Math.random);");
  const l = await layout(page);
  check(!l.over && l.btnOn, `6 monsters, long names, 20 + 15 cards at ${size}: no sideways scroll, "${l.btn}" on screen ` + JSON.stringify(l));
  await shot(page, 'crowd-' + size);
  check(!page.errs.length, `crowd ${size}: no console errors ` + JSON.stringify(page.errs));
  await page.context().close();
}

// 3. the three endings: 20 points, last monster standing, everyone falls at once
for (const [why, mod, want] of [
  ['points', "s.over = true; s.winners = [0]; s.why = 'points'; s.players[0].vp = 20; s.ask = null; s.q = [];", /You win/],
  ['last', "s.over = true; s.winners = [1]; s.why = 'last'; s.players[0].alive = false; s.players[0].hp = 0; s.ask = null; s.q = [];", /wins!/],
  ['none', "s.over = true; s.winners = []; s.why = 'none'; s.players.forEach(p => { p.alive = false; p.hp = 0; }); s.ask = null; s.q = [];", /Nobody wins/],
]) {
  const page = await newPage('phone');
  await page.evaluate(() => localStorage.clear());
  await resumeWith(page, 2, ['human', 'computer'], mod).catch(e => page.errs.push('resume: ' + e.message));
  await page.waitForTimeout(1000);
  const t = await page.evaluate(() => ({ status: (document.querySelector('#v-play .who') || {}).textContent, end: (document.querySelector('.endcard') || {}).textContent || '' }));
  check(want.test(t.status || '') && want.test(t.end), `ending "${why}": status and results say so ` + JSON.stringify({ status: t.status, end: t.end.slice(0, 60) }));
  await shot(page, 'end-' + why);
  check(!page.errs.length, `ending ${why}: no console errors ` + JSON.stringify(page.errs));
  await page.context().close();
}

// 4. no cards left anywhere: the market shows empty spots, the deck an empty spot, nothing breaks
{
  const page = await newPage('phone');
  await resumeWith(page, 3, ['human', 'computer', 'computer'], "s.discard.push(...s.deck.splice(0)); s.discard.length = 0; s.market = [null, 'heal', null];");
  const m = await page.evaluate(() => ({ spots: document.querySelectorAll('#market .slot').length, cards: document.querySelectorAll('#market .pc[data-slot]').length }));
  check(m.spots === 2 && m.cards === 1, 'empty deck and discard: two empty market spots, one card ' + JSON.stringify(m));
  await shot(page, 'empty-deck');
  check(!page.errs.length, 'empty deck: no console errors ' + JSON.stringify(page.errs));
  await page.context().close();
}

// 5. after the last reroll, tapping dice (each tap redraws) must not send "done" twice
{
  const page = await newPage('phone');
  await resumeWith(page, 2, ['human', 'computer'], "s.q = []; s.ask = null; s.cur = 0; s.q.push({ op: 'turn', seat: 0, less: 0 }); E.run(s, Math.random);");
  await page.evaluate(() => { window.__toasts = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('toast')) window.__toasts.push(n.textContent); }))).observe(document.body, { childList: true }); });
  await page.click('#btn-roll');
  await page.waitForTimeout(700);
  for (let r = 0; r < 2; r++) { await page.evaluate(() => window.__kot.act({ t: 'reroll', keep: [], use: 'normal' })); await page.waitForTimeout(100); }
  for (let k = 0; k < 4; k++) { await page.evaluate(k => { const d = document.querySelector(`[data-die="${k}"]`); if (d) d.onclick(); }, k); await page.waitForTimeout(60); }
  await page.waitForTimeout(1500);
  const toasts = await page.evaluate(() => window.__toasts);
  check(!toasts.length, 'tapping dice after the last reroll: no error message ' + JSON.stringify(toasts));
  await page.context().close();
}

// 6. you are knocked out while computers play on: the screen says so and the game still finishes
{
  const page = await newPage('phone');
  await resumeWith(page, 3, ['human', 'computer', 'computer'], "s.players[0].alive = false; s.players[0].hp = 0; s.players[0].cards = []; s.hist.push({ s: 0, turn: 1 }); if (s.tokyo.city === 0) s.tokyo.city = -1; s.q = []; s.ask = null; s.q.push({ op: 'turn', seat: 1, less: 0 }); E.run(s, Math.random);");
  const st = await page.evaluate(() => [...document.querySelectorAll('#v-play .who, #v-play .sub, #v-play .acts')].map(e => e.textContent.trim()).join(' | '));
  check(/out|knocked/i.test(st), 'knocked out, computers playing on: the screen says you are out: ' + st);
  await shot(page, 'knocked-out');
  let over = false;
  for (let k = 0; k < 600 && !over; k++) { await page.waitForTimeout(100); over = await page.evaluate(() => window.__kot.snap.pub.over); }
  check(over, 'the computers finish the game on their own');
  check(!page.errs.length, 'knocked out: no console errors ' + JSON.stringify(page.errs));
  await page.context().close();
}

// 7. switching Computer speed to Fast mid-game speeds the computers up at once (not only next game)
{
  const page = await newPage('phone');
  await page.goto(url + '#play'); // normal pace: no ?botms
  await resumeWith(page, 4, ['human', 'computer', 'computer', 'computer'], "s.players[0].alive = false; s.players[0].hp = 0; s.hist.push({ s: 0, turn: 1 }); if (s.tokyo.city === 0) s.tokyo.city = -1; s.q = []; s.ask = null; s.q.push({ op: 'turn', seat: 1, less: 0 }); E.run(s, Math.random);", { speed: 'normal' });
  const pace = () => page.evaluate(() => new Promise(r => { let n = 0, last = window.__kot.snap; const t = setInterval(() => { if (window.__kot.snap !== last) { n++; last = window.__kot.snap; } }, 20); setTimeout(() => { clearInterval(t); r(n); }, 3000); }));
  const before = await pace();
  await page.click('nav [data-tab="settings"]');
  await page.click('[data-k="speed"][data-v="fast"]');
  await page.click('nav [data-tab="play"]');
  const after = await pace();
  const over = await page.evaluate(() => window.__kot.snap.pub.over);
  check(over || after >= before * 1.6, `Fast mid-game: computer moves in 3 s went from ${before} to ${after}`);
  check(!page.errs.length, 'speed change: no console errors ' + JSON.stringify(page.errs));
  await page.context().close();
}

await browser.close();
console.log(failed ? failed + ' check(s) FAILED' : 'ALL PASS');
process.exit(failed ? 1 : 0);
