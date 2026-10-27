// King of Tokyo's part of My stats: a game turns into the right result.   Run: node --test tests/profile.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const KP = require('../js/kotprofile.js');
const { game: GAME } = require('../js/game.js');

const pl = (kind, o) => Object.assign({ kind, lvl: kind === 'computer' ? 'medium' : undefined, vp: 0, cards: [] }, o);

test('levels climb Easy < Medium < Hard and every achievement has words and a test', () => {
  const r = KP.LEVELS.map(l => l.rating);
  assert.ok(r[0] < r[1] && r[1] < r[2]);
  assert.ok(KP.ACH.length >= 8);
  for (const a of KP.ACH) assert.ok(a.id && a.title && a.desc && typeof a.test === 'function');
});

test('a win vs computers is rated at the strongest computer at the table', () => {
  const st = { over: true, winners: [0], why: 'points', turnNo: 30, players: [pl('human', { vp: 20, cards: [1, 2] }), pl('computer', { lvl: 'easy' }), pl('computer', { lvl: 'hard' })] };
  const r = KP.result({ st, me: 0, tokyoTurns: 4 });
  assert.equal(r.mode, 'computer');
  assert.equal(r.level, 'hard');
  assert.equal(r.won, true);
  assert.equal(r.draw, false);
  assert.equal(r.score, 20);
  assert.deepEqual(r.extra, { why: 'points', players: 3, vp: 20, cards: 2, tokyoTurns: 4, turns: 30 });
});

test('quitting mid-game is a loss marked quit; Undo makes it "with help" and unrated', () => {
  const st = { over: false, winners: [], turnNo: 5, players: [pl('human', { vp: 7 }), pl('computer'), pl('computer')] };
  const q = KP.result({ st, me: 0 });
  assert.equal(q.won, false);
  assert.equal(q.extra.quit, true);
  assert.equal(q.level, 'medium');
  const h = KP.result({ st: Object.assign({}, st, { over: true, winners: [0] }), me: 0, helped: true });
  assert.equal(h.mode, 'help');
  assert.equal(h.level, null);
});

test('shared win is a draw; pass and play has no winner at this screen; online keeps its mode', () => {
  const two = { over: true, winners: [0, 1], why: 'last', turnNo: 9, players: [pl('human'), pl('computer'), pl('computer')] };
  assert.equal(KP.result({ st: two, me: 0 }).draw, true);
  const ff = { over: true, winners: [1], players: [pl('human'), pl('human'), pl('computer')] };
  const f = KP.result({ st: ff, me: 0 });
  assert.equal(f.mode, 'friends');
  assert.equal(f.won, null);
  const o = KP.result({ st: ff, me: 1, online: true, daily: true });
  assert.equal(o.mode, 'online');
  assert.equal(o.daily, false, 'an online game is never the Daily');
});

test('a real finished engine game turns into a result (real state shape)', () => {
  let s = GAME.setup(4, { edition: '2016', level: 'easy', bay: true, monsters: [0, 1, 2, 3] }, Math.random, [{ kind: 'human', name: 'You' }, { kind: 'computer' }, { kind: 'computer' }, { kind: 'computer' }].map(x => Object.assign({ name: 'C' }, x)));
  s.players[0].kind = 'computer';   // let the computers play all four seats, then read it as seat 0's game
  for (let k = 0; k < 5000 && !s.over; k++) { const b = GAME.toAct(s)[0]; s = GAME.apply(JSON.parse(JSON.stringify(s)), b, GAME.bot({ state: s, pub: GAME.publicView(s), mine: GAME.privateView(s, b) }, b, Math.random), Math.random); }
  assert.ok(s.over);
  s.players[0].kind = 'human';
  const r = KP.result({ st: s, me: 0 });
  assert.equal(r.won, s.winners.length === 1 && s.winners[0] === 0);
  assert.ok(['points', 'last'].includes(r.extra.why));
  assert.equal(r.extra.players, 4);
  const pubR = KP.result({ st: GAME.publicView(s), me: 0 });
  assert.equal(pubR.won, r.won, 'the public view (online) gives the same result');
});
