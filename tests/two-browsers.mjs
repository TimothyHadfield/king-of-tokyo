// Two separate headless browsers play a 2-monster online room through the real shared Firebase project.
//   node tests/two-browsers.mjs [url] [--engine webkit|chromium] [--shots dir]
// Proves: create room, join by code, both screens follow the same game, reload mid-game resumes, play to the end.
// Moves are chosen by the Medium computer logic on each page and sent through the page's own act().
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const args = process.argv.slice(2);
const url = (args.find(a => a.startsWith('http')) || 'http://127.0.0.1:8614/').replace(/#.*$/, '');
const engine = args.includes('--engine') ? args[args.indexOf('--engine') + 1] : 'webkit';
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const fail = m => { console.error('FAIL: ' + m); process.exit(1); };

const opts = engine === 'webkit' ? { ...pw.devices['iPhone 15'], viewport: { width: 393, height: 659 } } : { viewport: { width: 1280, height: 800 } };
const bA = await pw[engine].launch(), bB = await pw[engine].launch();
const A = await (await bA.newContext(opts)).newPage(), B = await (await bB.newContext(opts)).newPage();
const errs = [], reloadNoise = [];
let reloading = false; // Bob's page unloading mid-request aborts Firestore channels; WebKit reports that as an error
for (const [n, p] of [['A', A], ['B', B]]) {
  p.on('console', m => { if (m.type() === 'error' && !/BloomFilter/.test(m.text())) errs.push(n + ': ' + m.text()); });
  p.on('pageerror', e => (reloading && n === 'B' && /firestore/.test(e.message) ? reloadNoise : errs).push(n + ' pageerror: ' + e.message));
}

for (const p of [A, B]) { await p.goto(url); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.goto(url + '#play'); }
// Alice: 2 monsters, second seat is a person (an open online seat)
await A.click('#seg-n [data-n="2"]');
if ((await A.textContent('.kindbtn[data-seat="1"]')).includes('Computer')) await A.click('.kindbtn[data-seat="1"]');
await A.fill('#in-name', 'Alice'); await A.click('#btn-create');
await A.waitForSelector('.code-big', { timeout: 25000 });
await A.waitForFunction(() => document.querySelector('.code-big').textContent.trim().length === 5, null, { timeout: 25000 });
const code = (await A.textContent('.code-big')).trim();
console.log('room code', code);
if (shots) await A.screenshot({ path: shots + '/online-lobby.png' });

await B.fill('#in-name', 'Bob'); await B.fill('#in-code', code); await B.click('#btn-join');
await A.waitForFunction(() => /Bob/.test(document.body.textContent), null, { timeout: 25000 });
console.log('Bob is seated');
await A.click('#btn-start');
await A.waitForSelector('#game', { timeout: 25000 });
await B.waitForSelector('#game', { timeout: 25000 });
console.log('PASS both screens show the game');

const view = p => p.evaluate(() => { const s = window.__kot.snap; return s && s.pub ? { over: s.pub.over, turn: s.pub.turnNo, mine: s.myTurn, seat: s.mySeat, vp: s.pub.players.map(x => x.vp), hp: s.pub.players.map(x => x.hp), deck: 'deck' in s.pub, winners: s.pub.winners } : null; });
const move = p => p.evaluate(() => {
  const s = window.__kot.snap;
  if (!s || !s.pub || s.pub.over || !s.myTurn) return false;
  const a = window.KotBots.decide(s.pub, s.mySeat, 'medium', Math.random, s.mine || {});
  window.__kot.act(a);
  return true;
});

let reloaded = false, shotMid = false, last = Date.now(), moves = 0;
for (;;) {
  const [va, vb] = [await view(A), await view(B)];
  if (va && va.deck) fail('the public view shows the deck order');
  if (va && va.over && vb && vb.over) break;
  if (!reloaded && va && va.turn >= 4) {
    reloaded = true;
    reloading = true;
    await B.reload();
    await B.waitForSelector('#game', { timeout: 30000 });
    await B.waitForTimeout(1500);
    reloading = false;
    console.log('PASS Bob reloaded mid-game (turn ' + va.turn + ') and is back in the room');
    continue;
  }
  if (!shotMid && shots && va && va.turn >= 3) { shotMid = true; await A.screenshot({ path: shots + '/online-alice.png' }); await B.screenshot({ path: shots + '/online-bob.png' }); }
  const did = (await move(A)) || (await move(B));
  if (did) { moves++; last = Date.now(); await A.waitForTimeout(700); }
  else await A.waitForTimeout(250);
  if (Date.now() - last > 60000) fail('no progress for 60 s: ' + JSON.stringify([va, vb]));
}
const [fa, fb] = [await view(A), await view(B)];
if (JSON.stringify(fa.winners) !== JSON.stringify(fb.winners) || JSON.stringify(fa.vp) !== JSON.stringify(fb.vp)) fail('the two screens disagree at the end: ' + JSON.stringify([fa, fb]));
await A.waitForSelector('#sheet .endcard', { timeout: 15000 });
await B.waitForSelector('#sheet .endcard', { timeout: 15000 });
if (shots) { await A.screenshot({ path: shots + '/online-end-alice.png' }); await B.screenshot({ path: shots + '/online-end-bob.png' }); }
console.log('PASS game over on both screens after', moves, 'moves; winners', JSON.stringify(fa.winners), 'points', JSON.stringify(fa.vp));
if (errs.length) fail('console errors:\n' + errs.join('\n'));
console.log('PASS no console errors (' + engine + ')' + (reloadNoise.length ? '; ignored ' + reloadNoise.length + ' aborted Firestore requests from the reload' : ''));
await bA.close(); await bB.close();
