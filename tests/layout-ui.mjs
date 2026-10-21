// Can you see the whole table? (2026-10-21 visibility pass)
//   node tests/layout-ui.mjs <url> [--shots dir]
// A late 6-monster game (you + 5 computers, 7 keep cards in front of you, 3-6 in front of rivals,
// one monster knocked out, both Tokyo spots taken) at iPhone, iPhone SE, phone sideways and three laptop sizes.
// Checks: the Tokyo board keeps its 2:1 shape and shows who is on it, rivals' numbers and names are readable,
// your cards and ability buttons are all on screen, rivals' cards stay on their own board, laptop card text
// is never cut, a tall sheet can still be finished sideways, no sideways scroll, no console errors.
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

const SIZES = [
  ['phone 393x659', 'webkit', { width: 393, height: 659 }],
  ['iPhone SE 320x568', 'webkit', { width: 320, height: 568 }],
  ['sideways 659x393', 'webkit', { width: 659, height: 393 }],
  ['laptop 1280x800', 'chromium', { width: 1280, height: 800 }],
  ['laptop 1440x900', 'chromium', { width: 1440, height: 900 }],
  ['laptop 1536x864', 'chromium', { width: 1536, height: 864 }],
  ['monitor 1920x1080 (log panel)', 'chromium', { width: 1920, height: 1080 }],
];

// a late game, built with the real engine: my roll, two rerolls left
const BUILD = () => {
  const E = window.KotEngine, K = window.KotCards;
  const kinds = ['human', 'computer', 'computer', 'computer', 'computer', 'computer'];
  const seats = kinds.map(k => ({ kind: k, name: k === 'human' ? 'You' : 'Computer' }));
  let s;
  for (let k = 0; k < 200; k++) { s = E.setup(6, { edition: '2016', bay: true }, Math.random, seats); if (s.cur === 0) break; }
  E.apply(s, 0, { t: 'roll' }, Math.random);
  const keeps = Object.keys(K.BY_ED['2016']).filter(id => K.BY_ED['2016'][id].keep && !['mimic', 'it-has-a-child', 'smoke-cloud', 'battery-monster'].includes(id));
  const take = ids => ids.map(id => { const j = s.deck.indexOf(id); if (j >= 0) s.deck.splice(j, 1); s.market = s.market.map(m => (m === id ? s.deck.pop() : m)); return { id, k: s.nextK++ }; });
  const want = [7, 4, 6, 5, 0, 3];
  let at = 0;
  const mine = ['rapid-healing', 'metamorph', 'were-only-making-it-stronger', 'friend-of-children', 'regeneration', 'freeze-time', 'shrink-ray'];
  s.players[0].cards = take(mine);
  const rest = keeps.filter(id => !mine.includes(id));
  for (let i = 1; i < 6; i++) { s.players[i].cards = take(rest.slice(at, at + want[i])); at += want[i]; }
  const st = [[6, 14, 4], [6, 4, 1], [1, 8, 4], [2, 11, 6], [0, 6, 0], [6, 10, 4]];
  s.players.forEach((p, i) => { [p.hp, p.vp, p.en] = st[i]; });
  s.players[4].alive = false; s.players[2].poison = 2; s.players[3].shrink = 1;
  s.tokyo = { city: 5, bay: 1 };
  s.turnNo = 26;
  s.market = ['jet-fighters', 'healing-ray', 'evacuation-orders'].map(id => { const j = s.deck.indexOf(id); if (j >= 0) s.deck.splice(j, 1); return id; });
  localStorage.setItem('kot-lab-v1', JSON.stringify({ settings: { kinds, speed: 'fast', mons: [0, 1, 2, 3, 4, 5] }, saved: { state: s, kinds } }));
};

const MEASURE = () => {
  const W = innerWidth, H = innerHeight;
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const vis = el => el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
  const fs = el => parseFloat(getComputedStyle(el).fontSize);
  const R = el => el.getBoundingClientRect();
  const board = q('#game .board'), br = board ? R(board) : null;
  const plates = qa('#game .board .plate b').filter(vis);
  const opp = qa('#game .opps .seat');
  const mins = sel => { const v = qa(sel).filter(vis).map(fs); return v.length ? Math.min(...v) : 99; };
  // my cards: each one on screen with at least a 14 px strip showing (the next card covers the rest)
  const my = qa('#game .mine .chipcard').filter(vis);
  const strips = my.map((e, k) => { const r = R(e); const nx = my[k + 1] ? R(my[k + 1]).left : r.right; return Math.round(Math.min(r.right, nx) - r.left); });
  const box = q('#game .mine') ? R(q('#game .mine')) : { left: 0, right: W };
  const myOff = my.filter(e => { const r = R(e); return r.right > Math.min(W, box.right) + 1 || r.left < Math.max(0, box.left) - 1 || r.bottom > H + 1; }).length;
  const abil = qa('#game .myarea .btn.small').filter(vis);
  const abilOff = abil.filter(e => { const r = R(e); return r.right > W + 1 || r.left < -1 || r.bottom > H + 1; }).length;
  // rivals' cards stay on their own board
  const spill = opp.flatMap(seat => { const sr = R(seat); return [...seat.querySelectorAll('.scards .chipcard')].filter(vis).filter(c => { const r = R(c); return r.right > sr.right + 1 || r.left < sr.left - 1; }).map(() => seat.querySelector('.nmx').textContent); });
  // every card's rules text fits the laptop market card (texts from both editions)
  let cut = [];
  const tx = q('#game .market .pc .tx');
  if (vis(tx)) {
    const host = tx.closest('.pc');
    const clone = host.cloneNode(true); clone.style.position = 'fixed'; clone.style.left = '-2000px'; clone.style.width = R(host).width + 'px'; document.body.appendChild(clone);
    const ct = clone.querySelector('.tx'), cn = clone.querySelector('.nm');
    for (const ed of Object.keys(window.KotCards.BY_ED)) for (const [id, c] of Object.entries(window.KotCards.BY_ED[ed])) {
      ct.textContent = c.text; cn.textContent = c.name; cn.classList.toggle('long', c.name.length > 16);
      const inner = clone.getBoundingClientRect().bottom - parseFloat(getComputedStyle(clone).borderBottomWidth);
      if (ct.scrollHeight > ct.clientHeight + 1 || ct.getBoundingClientRect().bottom > inner + 0.5 || cn.scrollHeight > cn.clientHeight + 1) cut.push(ed + ':' + id);
    }
    clone.remove();
  }
  return {
    overflow: document.documentElement.scrollWidth > W + 1 || document.documentElement.scrollHeight > H + 1,
    board: br ? { w: Math.round(br.width), h: Math.round(br.height), share: Math.round(br.width * br.height / (W * H) * 100) } : null,
    platesCut: plates.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent),
    plates: plates.length,
    rivalNum: Math.min(mins('#game .opps .dial b'), mins('#game .opps .cubes b')),
    rivalName: mins('#game .opps .nmx'),
    tags: Math.min(mins('#game .spot .tag'), mins('#game .where')),
    cardName: mins('#game .market .pc .nm'),
    my: my.length, minStrip: Math.min(...strips), myOff, abil: abil.length, abilOff,
    spill, cut: cut.length, cutIds: cut.slice(0, 6),
    // the CITY/BAY tag never sits on the monster or its name
    tagHit: qa('#game .spot').flatMap(sp => { const t = sp.querySelector('.tag'); if (!t) return []; const tr = R(t);
      return [...sp.querySelectorAll('.standee svg, .plate')].filter(e => { const r = R(e); return r.top < tr.bottom - 1 && r.bottom > tr.top + 1 && r.left < tr.right && r.right > tr.left; })
        .map(e => `${e.closest('.plate') ? 'name' : 'monster'} top ${Math.round(R(e).top)} under a tag ending at ${Math.round(tr.bottom)}`); }),
  };
};

for (const [name, eng, vp] of SIZES) {
  const browser = await pw[eng].launch();
  const ctx = await browser.newContext(eng === 'webkit' ? { ...pw.devices['iPhone 15'], viewport: vp } : { viewport: vp });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url + '?botms=40#play');
  await page.evaluate(BUILD);
  await page.reload();
  await page.click('#btn-resume');
  await page.waitForSelector('#game .board');
  await page.waitForTimeout(900);
  const m = await page.evaluate(MEASURE);
  if (shots) await page.screenshot({ path: `${shots}/layout-${vp.width}x${vp.height}.png` });
  const ratio = m.board ? m.board.w / m.board.h : 0;
  check(Math.abs(ratio - 2) / 2 < 0.03, `${name}: Tokyo board keeps its 2:1 shape (${m.board && m.board.w}x${m.board && m.board.h})`);
  check(m.plates === 2 && !m.platesCut.length, `${name}: both monsters in Tokyo are named in full on the board (${m.plates} shown, cut: ${JSON.stringify(m.platesCut)})`);
  if (vp.width >= 900) check(m.board.share >= 15, `${name}: the board gets at least 15% of the screen (${m.board.share}%)`);
  check(m.rivalNum >= 12, `${name}: rivals' hearts/stars/energy at least 12 px (${m.rivalNum})`);
  check(m.rivalName >= 10, `${name}: rivals' names at least 10 px (${m.rivalName})`);
  check(!m.tagHit.length, `${name}: the Tokyo City/Bay labels don't cover a monster or its name ${JSON.stringify(m.tagHit)}`);
  check(m.tags >= 10, `${name}: Tokyo City/Bay labels at least 10 px (${m.tags})`);
  check(m.cardName >= 10 || vp.width >= 900 && m.cardName >= 10, `${name}: market card names at least 10 px (${m.cardName})`);
  check(m.my === 7 && m.myOff === 0 && m.minStrip >= 14, `${name}: all 7 of my cards on screen, each at least 14 px showing (off ${m.myOff}, smallest ${m.minStrip} px)`);
  check(m.abil >= 1 && m.abilOff === 0, `${name}: my ability button (Heal) on screen (${m.abil} shown, ${m.abilOff} off)`);
  check(!m.spill.length, `${name}: rivals' cards stay on their own board (${JSON.stringify(m.spill)})`);
  if (vp.width >= 900) check(m.cut === 0, `${name}: every card's name and rules text fit the market card (${m.cut} cut ${JSON.stringify(m.cutIds)})`);
  check(!m.overflow, `${name}: no page scroll`);
  // a tall sheet (Metamorph at the end of the turn lists every keep card) can still be finished
  if (name.startsWith('sideways')) {
    await page.click('#btn-done');
    let ok = false;
    for (let k = 0; k < 80 && !ok; k++) { ok = !!(await page.$('#btn-end')); if (!ok) await page.waitForTimeout(100); }
    if (ok) {
      await page.click('#btn-end');
      await page.waitForSelector('#btn-endm');
      const reach = await page.click('#btn-endm', { timeout: 2500 }).then(() => true, () => false);
      check(reach, `${name}: the Metamorph end-of-turn sheet's End turn button can be tapped`);
    } else check(false, `${name}: reached my buy step`);
  }
  check(!errs.length, `${name}: no console errors ${JSON.stringify(errs.slice(0, 3))}`);
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
