// Evolutions (an option, off by default) on the game screen, in headless WebKit at iPhone size.
//   node tests/evo-ui.mjs [url]
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const args = process.argv.slice(2);
const url = (args.find(a => a.startsWith('http')) || 'http://127.0.0.1:8731/').replace(/[#?].*$/, '');
const W = +(args.find(a => /^--w=/.test(a)) || '--w=393').slice(4), H = +(args.find(a => /^--h=/.test(a)) || '--h=659').slice(4);
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed++; };

const browser = await pw.webkit.launch();
const ctx = await browser.newContext({ ...pw.devices['iPhone 15'], viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
// WebKit logs the page-update check (js/pwa.js, a HEAD fetch of the page) as an error when the test navigates
// away while it is still in flight; that is the test leaving, not the page failing
page.on('console', m => { if (m.type() === 'error' && !/due to access control checks/.test(m.text())) errs.push(m.text()); });

const KEY = 'kot-lab-v1';
const open = async () => { await page.goto(url + '?botms=30#play'); await page.waitForSelector('#seg-n, #game'); };
// a saved 2-monster game with evolutions on, at your turn start, with the cards each check needs
const resumeWith = async (hand, inPlay, extra) => {
  await page.goto(url + '#play');
  await page.evaluate(({ KEY, hand, inPlay, extra }) => {
    const g = window.KotGame.game;
    let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let s = g.setup(2, { evo: true, level: 'easy' }, rng, [{ kind: 'human', name: 'You' }, { kind: 'computer', name: 'Computer' }]);
    while (!(s.ask && s.ask.type === 'start' && s.ask.seats[0] === 0)) { const seat = g.toAct(s)[0]; s = g.apply(s, seat, g.bot({ state: s }, seat, rng), rng); }
    const p = s.players[0];
    p.eh = hand.slice(); p.evo = inPlay.map((id, j) => ({ id, k: 900 + j }));
    if (extra && extra.hp) p.hp = extra.hp;
    if (extra && extra.en != null) p.en = extra.en;
    localStorage.clear();
    localStorage.setItem(KEY, JSON.stringify({ settings: { evo: true, kinds: ['human', 'computer'] }, saved: { state: s, kinds: ['human', 'computer'], meta: {}, rs: 5 } }));
  }, { KEY, hand, inPlay, extra });
  await page.goto(url + '?botms=30#play');
  await page.waitForSelector('#btn-resume');
  await page.click('#btn-resume');
  await page.waitForSelector('#game');
};
const info = () => page.evaluate(() => { const s = window.__kot.snap; const me = s.mySeat, p = s.pub.players[me]; return { ask: s.pub.ask && s.toAct.includes(me) ? s.pub.ask.type : null, hp: p.hp, en: p.en, hand: (s.mine && s.mine.hand) || [], evo: (p.evo || []).map(c => c.id), dice: s.pub.t && s.pub.t.dice ? s.pub.t.dice.map(d => d.f) : [], log: s.pub.log.slice(-5).map(l => l.m) }; });
const inView = sel => page.evaluate(sel => { const r = document.querySelector(sel); if (!r) return false; const b = r.getBoundingClientRect(); return b.width > 0 && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth + 1; }, sel);
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

// 1. the Settings switch: off by default, remembered once on
await page.goto(url + '#play');
await page.evaluate(KEY => localStorage.clear(), KEY);
await open();
await page.goto(url + '#settings');
await page.waitForSelector('[data-sw="evo"]', { state: 'attached' });
check(!(await page.isChecked('[data-sw="evo"]')), 'Evolutions switch is off by default');
await page.locator('[data-sw="evo"] + span').click();
await page.reload();
await page.waitForSelector('[data-sw="evo"]', { state: 'attached' });
check(await page.isChecked('[data-sw="evo"]'), 'Evolutions switch stays on after a reload');
// a new game with it on deals evolutions; nothing shows in a base game
await page.goto(url + '?botms=30#play');
await page.waitForSelector('#btn-new');
await page.click('#btn-new');
await page.waitForSelector('#game');
check(await page.evaluate(() => window.__kot.room.state.evo === true && window.__kot.room.state.players.every(p => p.ed.length + p.eh.length === 8)), 'a new game with the switch on has each monster’s 8 evolutions');

// 2. cards in hand show (dashed, only to you); Giant Banana plays from its sheet
await resumeWith(['giant-banana', 'saurian-adaptability', 'cold-wave'], [], { hp: 5 });
let s0 = await info();
check(s0.ask === 'start', 'resumed at your turn start');
check(await page.locator('.mine .chipcard.evo.hand').count() === 3, 'three evolution cards in hand show in your row');
check(await inView('.mine .chipcard.evo.hand'), 'the hand is on screen without scrolling');
check(await page.locator('.mine .chipcard.evo.hand.ab').count() === 2, 'the two playable now glow (Saurian waits for dice)');
await page.click('.mine [data-evh="giant-banana"]');
await page.waitForSelector('#btn-evoplay');
await page.click('#btn-evoplay');
await page.waitForTimeout(200);
let s1 = await info();
check(s1.hp === s0.hp + 2 && s1.hand.length === 2 && s1.ask === 'start', 'Giant Banana: +2 hearts, out of the hand, still your turn start (' + s0.hp + '→' + s1.hp + ')');
// 3. Saurian Adaptability: pick a face shown and the face it becomes
await page.click('#btn-roll');
await page.waitForTimeout(250);
let s2 = await info();
check(s2.ask === 'roll', 'rolled');
await page.click('.mine [data-evh="saurian-adaptability"]');
await page.waitForSelector('#btn-evoplay');
check(await page.isDisabled('#btn-evoplay'), 'Play waits until both faces are picked');
const from = s2.dice[0], to = from === 'C' ? 'H' : 'C';
await page.click(`.facepick[data-row="from"] [data-f="${from}"]`);
await page.click(`.facepick[data-row="to"] [data-f="${to}"]`);
await page.click('#btn-evoplay');
await page.waitForTimeout(200);
let s3 = await info();
check(s3.dice.every((f, k) => (s2.dice[k] === from ? f === to : f === s2.dice[k])) && s3.ask === 'roll', 'Saurian Adaptability turned every ' + from + ' into ' + to + ' (' + s2.dice.join('') + '→' + s3.dice.join('') + ')');
check(await noOverflow(), 'no sideways scroll');

// 4. Gamma Breath in play: a button, the die tap, only the claw face offered; Encased in Ice freezes a die
await resumeWith([], ['gamma-breath', 'encased-in-ice', 'mothership-support', 'exotic-arms'], { hp: 6, en: 6 });
check(await page.locator('.mine .chipcard.evo:not(.hand)').count() === 4, 'four played evolutions show in your row');
check(await page.locator('[data-evm="arms"]').count() === 1 && await page.locator('[data-evm="mother"]').count() === 1, 'Load Arms and Mothership heal buttons before the roll');
await page.click('[data-evm="mother"]');
await page.waitForTimeout(150);
let g1 = await info();
check(g1.hp === 7 && g1.en === 5 && await page.locator('[data-evm="mother"]').count() === 0, 'Mothership Support: 1⚡ for 1 heart, once a turn');
await page.click('#btn-roll');
await page.waitForTimeout(250);
const shot = (args.find(a => a.startsWith('--shot=')) || '--shot=').slice(7) || join(homedir(), 'AppData/Local/Temp/claude/evo-ui.png');
await page.screenshot({ path: shot.replace(/\.png$/, '-abil.png') });
console.log('ability buttons at: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.abil .btn')].map(b => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)]; }))));
check(await inView('.abil [data-chg="ice"]') && await inView('.acts .btn'), 'ability and action buttons on screen without scrolling');
await page.click('[data-chg="gamma"]');
await page.click('[data-die="0"]');
await page.waitForSelector('.facepick [data-f]');
check(await page.locator('.facepick [data-f]').count() === 1 && await page.locator('.facepick [data-f="C"]').count() === 1, 'Gamma Breath offers only the claw');
await page.click('.facepick [data-f="C"]');
await page.waitForTimeout(150);
let g2 = await info();
check(g2.dice[0] === 'C' && await page.locator('[data-chg="gamma"]').count() === 0, 'Gamma Breath made a claw, once a turn');
await page.click('[data-chg="ice"]');
await page.click('[data-die="1"]');
await page.waitForTimeout(150);
check(await page.locator('[data-die="1"].ice').count() === 1, 'Encased in Ice: the tapped die is frozen');
check(await noOverflow(), 'no sideways scroll');
await page.screenshot({ path: shot });

// 5. play on with your evolution decisions: every one shows its buttons or its sheet, and the game ends cleanly
await resumeWith(['detachable-tail', 'giant-banana', 'radioactive-waste', 'anger-batteries', 'deep-dive', 'monkey-rush'], ['chest-thumping', 'play-with-your-food', 'freeze-ray', 'miraculous-catch', 'feline-motor'], { en: 8 });
const seen = {}, bad = [], tapped = {};
const EVO_ASKS = ['guard', 'food', 'thump', 'claim', 'freeze', 'dive', 'catch', 'evoend'];
for (let n = 0; n < 900; n++) {
  const st = await page.evaluate(() => { const s = window.__kot.snap; return { over: !!(s.pub && s.pub.over), ask: s.pub && s.pub.ask && s.toAct.includes(s.mySeat) ? s.pub.ask.type : null }; });
  if (st.over) break;
  if (!st.ask) { await page.waitForTimeout(40); continue; }
  if (EVO_ASKS.includes(st.ask)) {
    seen[st.ask] = (seen[st.ask] || 0) + 1;
    await page.waitForTimeout(60);
    const ui = await page.evaluate(() => ({ sheet: !!document.querySelector('#sheet button, #sheet [data-dive], #sheet [data-f]'), btn: [...document.querySelectorAll('.acts .btn')].some(b => !b.disabled), who: (document.querySelector('.status .who') || {}).textContent }));
    if (!ui.sheet && !ui.btn) bad.push(st.ask);
    if (ui.who === 'Your move') bad.push(st.ask + ' (no title)');
    // tap the real control (the first choice each time), then the decision must be gone without an error
    const tapSel = { guard: '.acts [data-guard]', food: '.acts [data-food="1"]', claim: '.acts [data-claim="1"]', evoend: '.acts [data-evoend="1"]', thump: '#btn-thok', freeze: '#sheet [data-f="H"]', dive: '#sheet [data-dive]', catch: '#btn-cno' }[st.ask];
    const before = await page.evaluate(() => JSON.stringify(window.__kot.room.state.ask));
    await page.locator(tapSel).first().click();
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => JSON.stringify(window.__kot.room.state.ask));
    tapped[st.ask] = (tapped[st.ask] || 0) + (after !== before ? 1 : 0);
    if (after === before) bad.push(st.ask + ' (tap did nothing)');
    continue;
  }
  // answer the way the computer would, closing any sheet first
  await page.evaluate(() => { const el = document.getElementById('sheet'); if (el) el.remove(); const s = window.__kot.snap; window.__kot.act(window.KotGame.game.bot({ state: window.__kot.room.state }, s.mySeat, Math.random)); });
  await page.waitForTimeout(30);
}
console.log('evolution decisions met: ' + JSON.stringify(seen) + ', answered by tapping: ' + JSON.stringify(tapped));
check(Object.keys(seen).length >= 2, 'met at least 2 kinds of evolution decision');
check(!bad.length, 'every evolution decision showed a title and its buttons or sheet' + (bad.length ? ': ' + bad.join(', ') : ''));
check(await page.evaluate(() => !!window.__kot.snap.pub.over), 'the game with evolutions played to its end');

check(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(failed ? failed + ' FAILED' : 'all passed');
process.exit(failed ? 1 : 0);
