// The guided first game: the stacked deal and dice play out as the coach's script says, through the
// real engine and the real computers.   Run: node --test tests/tutorial.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Cards = require('../js/cards.js');
const E = require('../js/engine.js');
const { game: GAME } = require('../js/game.js');
const COACH = require('../js/coach.js');
const KT = require('../js/tutorial.js');

const seats = () => KT.KINDS.map(k => ({ kind: k, name: k === 'human' ? 'You' : 'Computer' }));
function newTut() {
  const rng = COACH.rng(KT.SEED);
  const g = KT.rigGame(GAME, rng);
  const s = g.setup(3, Object.assign({}, KT.OPTIONS, { monsters: KT.monsters(4) }), rng, seats());
  return { rng, g, s };
}
const faces = s => s.t.dice.map(d => d.f).join('');
// play the computers until a person must act (what createLocal does)
function bots(g, s, rng) {
  for (let k = 0; k < 400 && !s.over; k++) {
    const who = g.toAct(s);
    if (!who.length || who.some(i => s.players[i].kind === 'human')) return s;
    for (const b of who) s = g.apply(JSON.parse(JSON.stringify(s)), b, g.bot({ state: s, pub: g.publicView(s), mine: g.privateView(s, b) }, b, rng), rng);
  }
  return s;
}
const act = (g, s, seat, a, rng) => g.apply(JSON.parse(JSON.stringify(s)), seat, a, rng);

test('tutorial deal: you go first, against two Easy computers, with a 3-energy card on sale', () => {
  const { s } = newTut();
  assert.equal(s.first, 0);
  assert.equal(s.cur, 0);
  assert.equal(s.n, 3);
  assert.ok(s.players.slice(1).every(p => p.kind === 'computer' && p.lvl === 'easy'));
  assert.equal(s.players[0].mon, 4, 'you keep the monster you picked');
  assert.equal(new Set(s.players.map(p => p.mon)).size, 3);
  assert.ok(s.market.some(id => Cards.card('2016', id).cost <= 3), 'something to buy with 3 energy: ' + s.market.join(','));
  assert.equal(s.ask.type, 'start');
});

test('the scripted first turn: keep 3 3 ⚡, reroll -> three 3s and three ⚡, then into Tokyo', () => {
  let { g, s, rng } = newTut();
  s = act(g, s, 0, { t: 'roll' }, rng);
  assert.equal(faces(s), '331E2H');
  assert.equal(rng.left(), 0, 'nothing left on the stack for anyone else');
  s = act(g, s, 0, { t: 'reroll', keep: [0, 1, 3], use: 'normal' }, rng);
  assert.equal(faces(s), '333EEE');
  s = act(g, s, 0, { t: 'done' }, rng);
  assert.equal(s.ask.type, 'buy');
  assert.equal(s.tokyo.city, 0);
  assert.equal(s.players[0].vp, 4, '3 for the 3s + 1 for moving in');
  assert.equal(s.players[0].en, 3);
});

test('a different keep still gets the scripted reroll faces, in order', () => {
  let { g, s, rng } = newTut();
  s = act(g, s, 0, { t: 'roll' }, rng);
  s = act(g, s, 0, { t: 'reroll', keep: [0, 1], use: 'normal' }, rng);
  assert.equal(faces(s), '333EEE');
  s = act(g, s, 0, { t: 'reroll', keep: [], use: 'normal' }, rng);   // the 2nd reroll is not scripted
  assert.equal(s.t.rerolls, 0);
});

test('the first computer hits you in Tokyo and you are asked to stay or leave; your next roll is claws', () => {
  let { g, s, rng } = newTut();
  s = act(g, s, 0, { t: 'roll' }, rng);
  s = act(g, s, 0, { t: 'reroll', keep: [0, 1, 3], use: 'normal' }, rng);
  s = act(g, s, 0, { t: 'done' }, rng);
  s = act(g, s, 0, { t: 'end' }, rng);
  s = bots(g, s, rng);
  assert.equal(s.cur, 1);
  assert.equal(s.ask.type, 'yield', 'asked to stay or leave');
  assert.ok(s.players[0].hp <= 8, 'took the claws: ' + s.players[0].hp);
  s = act(g, s, 0, { t: 'yield', leave: false }, rng);
  s = bots(g, s, rng);
  for (let k = 0; k < 5 && s.ask && s.ask.type === 'yield' && s.ask.seats.includes(0); k++) { s = act(g, s, 0, { t: 'yield', leave: false }, rng); s = bots(g, s, rng); }
  if (s.players[0].alive) {
    assert.equal(s.cur, 0);
    assert.equal(s.ask.type, 'start');
    assert.equal(s.turnNo, 4);
    assert.ok(s.players[0].vp >= 6, 'started in Tokyo: +2');
    s = act(g, s, 0, { t: 'roll' }, rng);
    assert.equal(faces(s), 'CCCEH1');
  }
});

test('whatever the computer decides, its claws reach you and you get the stay-or-leave choice (40 different streams)', () => {
  for (let shift = 0; shift < 40; shift++) {
    let { g, s, rng } = newTut();
    s = act(g, s, 0, { t: 'roll' }, rng);
    s = act(g, s, 0, { t: 'reroll', keep: [0, 1, 3], use: 'normal' }, rng);
    s = act(g, s, 0, { t: 'done' }, rng);
    s = act(g, s, 0, { t: 'end' }, rng);
    for (let k = 0; k < shift * 7; k++) rng();   // the computer's choices come from a different part of the stream
    s = bots(g, s, rng);
    assert.equal(s.ask && s.ask.type, 'yield', 'stream ' + shift + ': ' + (s.ask && s.ask.type) + ' ' + s.log.slice(-4).map(l => l.m).join(' / '));
  }
});

test('later turns are not scripted', () => {
  const st = { ask: { type: 'start' }, t: { seat: 0, dice: [], rerolls: 0 }, turnNo: 7, over: false };
  assert.equal(KT.rig(st, 0, { t: 'roll' }), null);
  assert.equal(KT.rig(Object.assign({}, st, { turnNo: 2 }), 2, { t: 'roll' }), null);
});

test('the rules sheet covers the whole base game', () => {
  const r = KT.rules(null);
  const ids = r.sections.map(x => x.id);
  for (const id of ['goal', 'setup', 'turn', 'dice', 'tokyo', 'cards', 'out', 'end']) assert.ok(ids.includes(id), 'missing ' + id);
  const all = r.sections.map(x => x.html).join(' ');
  for (const fact of ['10 ♥', '20 ★', '2 ★', '1 ★', 'Tokyo Bay', '2 ⚡', 'Keep', 'Discard', 'four 2s = 3 ★']) assert.ok(all.includes(fact), 'missing fact: ' + fact);
});

test('the coach script: every step has words, and action steps wait on the game', () => {
  const ctx = { pub: () => null, me: () => 0, ask: () => null, inTokyo: () => false };
  const st = KT.steps(ctx);
  assert.ok(st.length >= 12);
  for (const s of st) assert.ok((s.text || s.html || '').length > 5);
  for (const s of st) if (s.text) assert.ok(s.text.split(/\s+/).length <= 40, 'too long: ' + s.text);
});
