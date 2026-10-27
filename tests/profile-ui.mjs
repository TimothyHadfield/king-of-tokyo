// My stats, Undo, the Daily game and the end-of-game review, through the real screens (headless WebKit, iPhone).
//   node tests/profile-ui.mjs <url>        (serve the game folder first)
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');

const url = (process.argv.slice(2).find(a => a.startsWith('http')) || 'http://127.0.0.1:8614/') + '?botms=20';
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) failed++; };
const errors = [];

const browser = await pw.webkit.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__kot && document.querySelector('#v-play #btn-new'));
  await page.evaluate(() => { if (window.COACH) COACH.closeOffer(); });
  ok(await page.isVisible('#btn-stats0') && await page.isVisible('#btn-daily0'), 'setup shows My stats and Daily game');

  // ---- Undo: roll, take it back, roll again -> the same dice
  await page.click('#v-play #btn-new');
  await page.evaluate(() => { if (window.COACH) COACH.closeOffer(); });
  await page.waitForSelector('#v-play #btn-roll:not([disabled])', { timeout: 60000 });
  ok(await page.isDisabled('#btn-undo'), 'Undo is there but off before your first move');
  await page.click('#v-play #btn-roll');
  await page.waitForFunction(() => window.__kot.snap.pub.ask.type === 'roll');
  const dice1 = await page.evaluate(() => window.__kot.snap.pub.t.dice.map(d => d.f).join(''));
  ok(!(await page.isDisabled('#btn-undo')), 'Undo lights up after a move');
  await page.click('#btn-undo');
  await page.waitForFunction(() => window.__kot.snap && window.__kot.snap.pub.ask.type === 'start');
  ok(await page.evaluate(() => window.__kot.game.helped === true), 'an undone game is marked "with help"');
  await page.click('#v-play #btn-roll');
  await page.waitForFunction(() => window.__kot.snap.pub.ask.type === 'roll');
  const dice2 = await page.evaluate(() => window.__kot.snap.pub.t.dice.map(d => d.f).join(''));
  ok(dice1 === dice2, 'the same dice come back after Undo (' + dice1 + ' / ' + dice2 + ')');
  if (shots) await page.screenshot({ path: join(shots, 'kot-undo-393.png') });

  // ---- quitting after a move counts as a loss
  await page.click('#btn-menu');
  await page.click('#btn-quit');
  const s1 = await page.evaluate(() => window.Profile.stats());
  ok(s1.games === 1 && s1.losses === 1 && s1.byMode.help && s1.byMode.help.g === 1, 'quit counted as a loss, "with help": ' + JSON.stringify({ g: s1.games, l: s1.losses, m: s1.byMode }));

  // ---- the Daily: no Undo, plays to the end, review, recorded once as the Daily
  await page.click('#btn-daily0');
  await page.evaluate(() => { if (window.COACH) COACH.closeOffer(); });
  await page.waitForFunction(() => window.__kot.snap && window.__kot.snap.pub);
  ok(await page.evaluate(() => !!window.__kot.game.daily && window.__kot.snap.pub.players.length === 4 && window.__kot.snap.pub.edition === '2016'), 'Daily: you + 3 computers, 2016');
  ok(!(await page.$('#btn-undo')), 'no Undo in the Daily');
  for (let i = 0; i < 4000; i++) {
    const st = await page.evaluate(() => { const s = window.__kot.snap; return s && s.pub ? { over: s.pub.over } : null; });
    if (st && st.over) break;
    const b = await page.$('#v-play .acts button.primary:not([disabled]), #v-play #btn-stay');
    if (b) { try { await b.click({ timeout: 500 }); } catch (e) { /* redrawn */ } }
    await page.waitForTimeout(40);
  }
  ok(await page.evaluate(() => window.__kot.snap.pub.over), 'Daily played to the end');
  await page.waitForTimeout(1500);
  const s2 = await page.evaluate(() => ({ s: window.Profile.stats(), d: window.Profile.daily.played() }));
  ok(s2.s.games === 2 && s2.d, 'Daily recorded: ' + JSON.stringify({ g: s2.s.games, daily: s2.d }));
  const tl = await page.evaluate(() => window.__kot.game.tl.length);
  ok(tl > 5, 'timeline has a frame per turn: ' + tl);
  await page.evaluate(() => { const x = document.querySelector('#sheet #btn-review2') || document.querySelector('#btn-review'); x.click(); });
  await page.waitForSelector('#sheet .rv-chart');
  ok(await page.isVisible('#sheet .rv-chart polyline'), 'review shows the star race');
  await page.click('#rv-prev'); await page.click('#rv-prev');
  ok(/Turn \d+/.test(await page.textContent('#rv-body')), 'stepping back shows an earlier turn');
  if (shots) await page.screenshot({ path: join(shots, 'kot-review-393.png') });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 0, 'no sideways overflow with the review open (' + over + ')');
  await page.click('#sheet #btn-x');

  // ---- a reload of the finished game does not count it again; My stats opens and Back closes it
  await page.reload();
  await page.waitForFunction(() => window.__kot && document.querySelector('#v-play #btn-new'));
  await page.evaluate(() => { if (window.COACH) COACH.closeOffer(); });
  ok(await page.evaluate(() => window.Profile.stats().games) === 2, 'not counted twice after a reload');
  ok((await page.textContent('#btn-daily0')).includes('✓'), 'Daily button shows done');
  await page.click('#btn-stats0');
  await page.waitForSelector('.pf-ov');
  if (shots) await page.screenshot({ path: join(shots, 'kot-stats-393.png') });
  await page.goBack();
  await page.waitForTimeout(300);
  ok(!(await page.$('.pf-ov')), 'Back closes My stats');
  ok(await page.isVisible('#v-play #btn-new'), 'and the game screen is still there');
} finally { await browser.close(); }
ok(!errors.length, 'no console errors ' + errors.slice(0, 3).join(' | '));
process.exit(failed ? 1 : 0);
