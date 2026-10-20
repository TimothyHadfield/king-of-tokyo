// Sound & effects through the real screens (headless Chromium, which has Web Audio), spying on FX.
//   node tests/fx-ui.mjs <url> [--shots dir]
// 1) defaults: a full 2-monster game plays dice / Tokyo / claw sounds, your-turn chime, and ends with
//    celebrate('win' or 'lose') matching the result, confetti on a win;
// 2) Sound off + Animations off (set in Settings): a full game makes no sound and runs no animation
//    (no Web Animations, no CSS tumble, no floats, no confetti canvas).
// Needs playwright from ~/.claude/tools.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const args = process.argv.slice(2);
const url = args.find(a => a.startsWith('http')) || 'http://127.0.0.1:8614/';
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
// ERR_CONNECTION_REFUSED = Python's local test server dropping a request (known noise, see progress.md NOT verified)
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
// spies installed before any script runs: count Web Animations and new .float / canvas elements
await page.addInitScript(() => {
  window.__spy = { anim: 0, floats: 0, canvas: 0, rollAnim: new Set() };
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (...a) { window.__spy.anim++; return orig.apply(this, a); };
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) {
    if (n.classList.contains('float') || (n.querySelector && n.querySelector('.float'))) window.__spy.floats++;
    if (n.tagName === 'CANVAS') window.__spy.canvas++;
  } }).observe(document, { childList: true, subtree: true });
});
const wrapFx = () => page.evaluate(() => {
  const S = window.__spy;
  S.calls = []; S.played = []; S.celebrate = [];
  if (!window.FX.__wrapped) {
    const p = window.FX.play, c = window.FX.celebrate;
    window.FX.play = (n, o) => { const r = p(n, o); S.calls.push(n); if (r) S.played.push(n); return r; };
    window.FX.celebrate = o => { S.celebrate.push({ kind: o.kind }); return c(o); };
    window.FX.__wrapped = true;
  }
  S.anim = 0; S.floats = 0; S.canvas = 0; S.rollAnim = new Set();
});

async function playGame(label) {
  await page.click('nav [data-tab="play"]');
  await page.click('#seg-n [data-n="2"]');
  await wrapFx();
  await page.click('#btn-new');
  await page.waitForSelector('#game');
  let steps = 0, midShot = false;
  for (;;) {
    if (++steps > 3000) fail(label + ': game did not end');
    const st = await page.evaluate(() => { const s = window.__kot.snap; if (!s || !s.pub) return null;
      document.querySelectorAll('.die.roll').forEach(d => window.__spy.rollAnim.add(getComputedStyle(d).animationName));
      return { over: s.pub.over, ask: s.pub.ask && s.toAct.includes(s.mySeat) ? s.pub.ask.type : null, turn: s.pub.turnNo }; });
    if (!st) { await page.waitForTimeout(50); continue; }
    if (st.over) break;
    if (!st.ask) { await page.waitForTimeout(40); continue; }
    const sheet = await page.$('#sheet');
    if (sheet && !['ray', 'mimic'].includes(st.ask)) await page.click('#sheet', { position: { x: 5, y: 5 } }).catch(() => {});
    switch (st.ask) {
      case 'start': await page.click('#btn-roll'); break;
      case 'roll': {
        if (shots && !midShot && st.turn >= 5 && label === 'defaults') { midShot = true; await page.waitForTimeout(250); await page.screenshot({ path: `${shots}/mid-game-393.png` }); }
        const dice = await page.$$eval('[data-die]', els => els.map(e => ({ kept: e.classList.contains('kept'), hint: e.classList.contains('hint') })));
        const can = await page.$eval('#btn-reroll', b => !b.disabled).catch(() => false);
        if (!can || dice.every(d => d.hint)) { await page.click('#btn-done', { timeout: 1500 }).catch(() => {}); break; }
        for (let k = 0; k < dice.length; k++) if (dice[k].kept !== dice[k].hint) await page.click(`[data-die="${k}"]`);
        const ok = await page.$eval('#btn-reroll', b => !b.disabled).catch(() => false);
        await page.click(ok ? '#btn-reroll' : '#btn-done', { timeout: 1500 }).catch(() => {});
        break;
      }
      case 'yield': await page.click(Math.random() < 0.5 ? '#btn-stay' : '#btn-leave'); break;
      case 'wings': await page.click('#btn-wings'); break;
      case 'probe': case 'opp': await page.click('#btn-pass'); break;
      case 'ray': await page.waitForSelector('#btn-rayok'); await page.click('#btn-rayok'); break;
      case 'mimic': await page.waitForSelector('#sheet [data-k]'); await page.click('#sheet [data-k]'); break;
      case 'buy': {
        const can = await page.$$('[data-slot].can');
        if (can.length) { await can[0].click(); await page.waitForSelector('#sheet'); const b = await page.$('#btn-buy:not([disabled])'); if (b) { await b.click(); break; } await page.click('#btn-x'); }
        await page.click('#btn-end'); const m = await page.$('#btn-endm'); if (m) await m.click();
        break;
      }
      default: fail('unknown ask ' + st.ask);
    }
    await page.waitForTimeout(30);
  }
  await page.waitForSelector('#sheet .endcard', { timeout: 15000 });
  await page.waitForTimeout(label === 'defaults' ? 900 : 1500);
  if (shots && label === 'defaults') await page.screenshot({ path: `${shots}/win-screen-393.png` });
  const r = await page.evaluate(() => { const s = window.__kot.snap, p = s.pub; return { spy: Object.assign({}, window.__spy, { rollAnim: [...window.__spy.rollAnim] }), humanWon: p.winners.some(i => p.players[i].kind === 'human'), winners: p.winners, turns: p.turnNo }; });
  await page.waitForTimeout(2600);
  await page.click('#btn-again2');
  await page.waitForSelector('#btn-new');
  return r;
}

await page.goto(url);
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(url + '?botms=40#settings');
await page.click('[data-k="speed"][data-v="fast"]');
if (shots) { await page.screenshot({ path: `${shots}/settings-393.png` }); }

// ---- 1: defaults
const a = await playGame('defaults');
const has = n => a.spy.played.includes(n);
console.log('defaults: game over turn', a.turns, a.humanWon ? '(you won)' : '(computer won)', '·', a.spy.played.length, 'sounds:', [...new Set(a.spy.played)].join(' '));
for (const n of ['diceRoll', 'diceLand', 'turn', 'roar', 'place']) if (!has(n)) fail('defaults: never played ' + n);
if (!['smash', 'star', 'zap', 'heal'].some(has)) fail('defaults: no claw / star / energy / heart sound');
const kinds = a.spy.celebrate.map(c => c.kind).filter(k => k !== 'big');
if (kinds.length !== 1 || kinds[0] !== (a.humanWon ? 'win' : 'lose')) fail('celebrate kinds ' + JSON.stringify(a.spy.celebrate) + ' for humanWon=' + a.humanWon);
if (a.humanWon && !a.spy.canvas) fail('win without confetti canvas ' + JSON.stringify(a.spy.celebrate) + ' anim ' + a.spy.anim + ' ' + JSON.stringify(await page.evaluate(() => window.FX.settings)));
if (!a.spy.anim) fail('defaults: no animation ran');
if (!a.spy.floats) fail('defaults: no +N floats');
if (!a.spy.rollAnim.includes('tumble')) fail('defaults: dice did not tumble ' + a.spy.rollAnim);
console.log('defaults OK: celebrate', kinds[0], '· animations', a.spy.anim, '· floats', a.spy.floats, '· confetti canvases', a.spy.canvas);

// ---- 2: Sound off + Animations off, through the Settings switches
await page.click('nav [data-tab="settings"]');
await page.click('.fx-set [data-row="sound"] .switch span');
await page.click('.fx-set [data-row="animations"] .switch span');
const s2 = await page.evaluate(() => window.FX.settings);
if (s2.sound || s2.animations) fail('switches did not turn off: ' + JSON.stringify(s2));
const b = await playGame('off');
console.log('off: game over turn', b.turns, '·', b.spy.calls.length, 'sound requests,', b.spy.played.length, 'played · animations', b.spy.anim, '· floats', b.spy.floats, '· canvases', b.spy.canvas, '· tumble', b.spy.rollAnim.join(','));
if (!b.spy.calls.length) fail('off: the game asked for no sounds at all (spy broken?)');
if (b.spy.played.length) fail('off: sounds played: ' + b.spy.played.join(' '));
if (b.spy.anim) fail('off: ' + b.spy.anim + ' Web Animations ran');
if (b.spy.floats) fail('off: floats shown');
if (b.spy.canvas) fail('off: confetti canvas');
if (b.spy.rollAnim.some(x => x !== 'none')) fail('off: dice still tumble: ' + b.spy.rollAnim);
if (b.spy.celebrate.length < 1) fail('off: celebrate not called at the end');

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) fail('page overflows');
if (errs.length) fail('console errors:\n' + errs.join('\n'));
console.log('PASS fx-ui: sounds + celebration with defaults; silent and still with Sound and Animations off');
await browser.close();
