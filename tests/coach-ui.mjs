// The guided first game and the rules sheet on real screens (2026-10-27).
//   node tests/coach-ui.mjs <url> [--shots dir]
// iPhone (WebKit 393x659), iPhone SE (320x568), phone sideways (659x393), laptops (Chromium 1280x800, 1440x900),
// one browser at a time. A fresh visit offers the tutorial once; "Teach me" starts a stacked game (you roll
// 3 3 1 ⚡ 2 ♥); the coach is walked to the end doing what each step asks; at every step the note is on screen
// and off what it points at; a reload in the middle comes back to the same step after Resume; the rules sheet
// opens from the setup screen, the game menu and Settings, is readable (15 px+, no sideways scroll) and Back
// closes it; Settings → Replay tutorial starts it again. No console errors.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const args = process.argv.slice(2);
const url = (args.find(a => a.startsWith('http')) || 'http://127.0.0.1:8614/').replace(/[#?].*$/, '');
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };
const SIZES = [
  ['393x659', 'webkit', 393, 659, true], ['320x568', 'webkit', 320, 568, true], ['659x393', 'webkit', 659, 393, true],
  ['1280x800', 'chromium', 1280, 800, false], ['1440x900', 'chromium', 1440, 900, false],
].filter(s => !only || s[0] === only);

const state = () => {
  const K = window.__kot, T = K.tour, b = document.querySelector('.coach-layer:not(.coach-off) .coach-bubble');
  const r = document.querySelector('.coach-ring');
  const g = b ? b.getBoundingClientRect() : null, rr = b && r && r.style.display !== 'none' ? r.getBoundingClientRect() : null;
  const p = K.snap && K.snap.pub;
  return {
    active: !!(T && T.active), idx: T ? T.index : -1, shown: !!b, next: !!(b && b.querySelector('[data-coach="next"]')),
    b: g && { l: g.left, t: g.top, r: g.right, bt: g.bottom }, ring: rr && { l: rr.left, t: rr.top, r: rr.right, bt: rr.bottom },
    vw: innerWidth, vh: innerHeight, sx: document.documentElement.scrollWidth,
    ask: p && K.snap.toAct.includes(K.snap.mySeat) ? p.ask.type : null, dice: p && p.t ? p.t.dice.map(d => d.f).join('') : '', turn: p ? p.turnNo : 0,
    text: b ? b.querySelector('.coach-text').textContent.slice(0, 50) : '',
  };
};

async function rulesCheck(page, name, how) {
  await page.waitForTimeout(350);
  const rs = await page.evaluate(() => {
    const back = document.querySelector('.coach-rules-back'); if (!back) return null;
    const body = back.querySelector('.coach-rules-body'), sh = back.querySelector('.coach-rules').getBoundingClientRect();
    const small = [...body.querySelectorAll('p:not(.coach-rules-foot), li, td')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 14).length;
    return { font: parseFloat(getComputedStyle(body).fontSize), small, sideways: body.scrollWidth > body.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth,
      inView: sh.top >= -0.5 && sh.bottom <= innerHeight + 0.5 && sh.left >= -0.5 && sh.right <= innerWidth + 0.5, secs: body.querySelectorAll('section').length, words: body.textContent.split(/\s+/).length };
  });
  check(rs && rs.font >= 15 && rs.small === 0 && !rs.sideways && rs.inView && rs.secs >= 8, `${name}: rules from ${how}: ${rs && rs.secs} sections, ${rs && rs.words} words, ${rs && rs.font}px, sideways ${rs && rs.sideways}`);
}

for (const [name, eng, w, h, mobile] of SIZES) {
  const browser = await pw[eng].launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(url + '?botms=250#play'); await page.waitForTimeout(500);
    check(await page.locator('.coach-offer').count() === 1, `${name}: first visit offers the guided game`);
    const offerOk = await page.evaluate(() => { const o = document.querySelector('.coach-offer').getBoundingClientRect(), t = document.querySelector('nav.tabs').getBoundingClientRect(); return o.bottom <= innerHeight && (o.bottom <= t.top + 1 || o.top >= t.bottom - 1 || innerWidth >= 900); });
    check(offerOk, `${name}: the offer sits clear of the tab bar`);
    if (shots) await page.screenshot({ path: `${shots}/${name}-offer.png` });
    // rules from the setup screen; Back closes them and stays on the app
    await page.click('#btn-rules0'); await rulesCheck(page, name, 'setup');
    if (shots) await page.screenshot({ path: `${shots}/${name}-rules.png` });
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check(await page.locator('.coach-rules-back').count() === 0, `${name}: Esc closes the rules`);
    await page.click('.coach-offer [data-o="yes"]'); await page.waitForTimeout(500);
    let s = await page.evaluate(state);
    check(s.active && s.idx === 0, `${name}: Teach me starts the coach`);
    let bad = 0, seen = new Set(), reloaded = false, stuck = 0, first = '';
    for (let k = 0; k < 400 && s.active; k++) {
      await page.waitForTimeout(220);
      s = await page.evaluate(state);
      if (!s.active) break;
      if (process.env.DBG > 1) console.log('  ~', s.idx, s.shown, s.ask, s.turn);
      // no note: waiting for the computers, or a decision the coach doesn't cover (a 2nd hit in Tokyo)
      if (!s.shown) { if (s.ask === 'yield' && s.idx > 12) await page.click('#btn-stay').catch(() => {}); if (++stuck > 160) break; continue; }
      stuck = 0;
      if (!seen.has(s.idx)) {
        seen.add(s.idx);
        const on = s.b.l >= -0.5 && s.b.t >= -0.5 && s.b.r <= s.vw + 0.5 && s.b.bt <= s.vh + 0.5;
        const cover = s.ring && s.b.l < s.ring.r - 0.5 && s.b.r > s.ring.l + 0.5 && s.b.t < s.ring.bt - 0.5 && s.b.bt > s.ring.t + 0.5;
        if (!on || cover || s.sx > s.vw) { bad++; console.log('   bad step', JSON.stringify(s)); }
        if (shots && [1, 3, 6, 9, 12].includes(s.idx)) { await page.waitForTimeout(350); await page.screenshot({ path: `${shots}/${name}-step${s.idx}.png` }); }
      }
      if (s.idx === 9 && !reloaded) {       // reload in the middle of the tutorial
        reloaded = true;
        await page.reload(); await page.waitForTimeout(600);
        check(await page.locator('.coach-offer').count() === 0, `${name}: no second offer after a reload`);
        await page.click('#btn-resume'); await page.waitForTimeout(600);
        const r = await page.evaluate(state);
        check(r.active && r.idx === 9, `${name}: Resume brings the coach back at the same step (${r.idx})`);
        continue;
      }
      if (process.env.DBG) console.log('   ', s.idx, s.ask, s.next, s.text);
      // (a note can move on by itself while it's being tapped, e.g. a computer attacks: then just look again)
      if (s.next) { await page.click('.coach-bubble [data-coach="next"]', { timeout: 3000 }).catch(() => {}); continue; }
      if (s.ask === 'start') { await page.click('#btn-roll'); await page.waitForTimeout(300); const d = (await page.evaluate(state)).dice; if (!first) first = d; continue; }
      if (s.ask === 'roll' && s.idx === 6) { for (const i of [0, 1, 3]) { await page.click(`#v-play [data-die="${i}"]`); await page.waitForTimeout(80); } await page.click('#btn-reroll'); continue; }
      if (s.ask === 'roll') { await page.click('#btn-done'); continue; }
      if (s.ask === 'buy') { await page.click('#btn-end'); await page.waitForTimeout(200); if (await page.locator('#sheet').count()) await page.keyboard.press('Escape'); continue; }
      if (s.ask === 'yield') { await page.click('#btn-stay'); continue; }
    }
    check(first === '331E2H', `${name}: the stacked first roll (${first})`);
    check(!s.active && seen.size >= 11, `${name}: the coach runs to the end (${seen.size} steps shown: ${[...seen].join(',')})`);
    check(bad === 0, `${name}: every note on screen and off its target`);
    // the game goes on, the rules from the game menu
    await page.click('#btn-menu'); await page.waitForTimeout(250);
    await page.click('#btn-rules1'); await rulesCheck(page, name, 'game menu');
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    // Settings: rules + replay
    await page.click('nav.tabs button[data-tab="settings"]'); await page.waitForTimeout(300);
    check(await page.locator('#btn-tut').isVisible(), `${name}: Settings has Replay tutorial`);
    await page.click('#btn-rules2'); await rulesCheck(page, name, 'Settings');
    await page.goBack(); await page.waitForTimeout(300);
    check(await page.locator('.coach-rules-back').count() === 0 && (await page.locator('#btn-tut').isVisible()), `${name}: Back closes the rules and stays on Settings`);
    await page.click('#btn-rules2'); await page.waitForTimeout(250);
    await page.click('.coach-rules [data-r="x"]'); await page.waitForTimeout(150);
    await page.click('#btn-tut'); await page.waitForTimeout(600);
    s = await page.evaluate(state);
    check(s.active && s.idx === 0 && s.shown && (await page.evaluate(() => window.__kot.tut)), `${name}: Replay tutorial starts a new guided game`);
    if (shots) await page.screenshot({ path: `${shots}/${name}-replay.png` });
    await page.click('.coach-bubble [data-coach="skip"]'); await page.waitForTimeout(200);
    check(await page.locator('.coach-layer').count() === 0, `${name}: Skip removes the coach`);
    check(errs.length === 0, `${name}: no console errors ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  } finally { await browser.close(); }
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
