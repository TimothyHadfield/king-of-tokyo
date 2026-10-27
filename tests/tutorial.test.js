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

test('the first computer hits you in Tokyo and you are asked to stay or leave; the other computer is calm; your next roll is four 3s and two claws', () => {
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
  assert.equal(s.cur, 0, 'no second hit before your turn');
  assert.equal(s.ask.type, 'start');
  assert.equal(s.turnNo, 4);
  assert.ok(s.players[0].vp >= 6, 'started in Tokyo: +2');
  s = act(g, s, 0, { t: 'roll' }, rng);
  assert.equal(faces(s), '3333CC');
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

test('nothing is stacked after the round of your 4th turn', () => {
  const st = { ask: { type: 'start' }, t: { seat: 0, dice: [], rerolls: 0 }, turnNo: KT.LAST + 1, over: false, players: [{ hp: 10, alive: true }], tokyo: { city: -1, bay: -1 } };
  assert.equal(KT.rig(st, 0, { t: 'roll' }), null);
  assert.equal(KT.rig(Object.assign({}, st, { turnNo: 20 }), 2, { t: 'roll' }), null);
});

// play the whole guided game the way the coach says (or another way), computers included
function playTut(opts) {
  const o = Object.assign({ buy: true, stay1: true, stay2: false, shift: 0, monster: 4 }, opts);
  const rng = COACH.rng(KT.SEED);
  const g = KT.rigGame(GAME, rng);
  let s = g.setup(3, Object.assign({}, KT.OPTIONS, { monsters: KT.monsters(o.monster) }), rng, seats());
  const seen = { yields: 0, minHp: 10, healed: false, bought: null, leftOnHit2: false, inTokyoT4: false };
  let shifted = false;
  for (let k = 0; k < 2000 && !s.over; k++) {
    const who = g.toAct(s);
    if (!who.includes(0)) {
      if (!shifted && s.turnNo === 2) { for (let j = 0; j < o.shift * 7; j++) rng(); shifted = true; }
      const b = who[0];
      s = g.apply(JSON.parse(JSON.stringify(s)), b, g.bot({ state: s, pub: g.publicView(s), mine: g.privateView(s, b) }, b, rng), rng);
      continue;
    }
    const a = s.ask.type;
    let act;
    if (a === 'start') { if (s.turnNo === 4) seen.inTokyoT4 = s.tokyo.city === 0; act = { t: 'roll' }; }
    else if (a === 'roll') act = s.turnNo === 1 && s.t.rerolls === 2 ? { t: 'reroll', keep: [0, 1, 3], use: 'normal' } : { t: 'done' };
    else if (a === 'buy') {
      const i = s.market.indexOf('poison-quills');
      if (o.buy && s.turnNo === 1 && i >= 0 && s.players[0].en >= 3) { act = { t: 'buy', i }; seen.bought = 'poison-quills'; }
      else act = { t: 'end' };
    } else if (a === 'yield') {
      seen.yields++;
      const leave = seen.yields === 1 ? !o.stay1 : !o.stay2;
      if (seen.yields === 2 && leave) seen.leftOnHit2 = true;
      act = { t: 'yield', leave };
    } else act = GAME.bot({ state: s, pub: g.publicView(s), mine: g.privateView(s, 0) }, 0, rng);
    const hp0 = s.players[0].hp;
    s = g.apply(JSON.parse(JSON.stringify(s)), 0, act, rng);
    if (s.players[0].hp > hp0 && s.turnNo === 7) seen.healed = true;
    seen.minHp = Math.min(seen.minHp, s.players[0].hp);
  }
  return { s, seen };
}

test('the coach’s way: buy Poison Quills, stay, leave on the 2nd hit, heal, and win with 20 ★ on your 4th turn', () => {
  const { s, seen } = playTut({});
  assert.equal(seen.bought, 'poison-quills');
  assert.equal(seen.yields, 2, 'asked to stay or leave twice');
  assert.ok(seen.inTokyoT4, 'you start your 2nd turn in Tokyo');
  assert.ok(seen.leftOnHit2, 'left Tokyo on the 2nd hit');
  assert.ok(seen.healed, 'healed on your 3rd turn');
  assert.ok(seen.minHp >= 3, 'never below 3 ♥: ' + seen.minHp);
  assert.ok(s.over, 'game over');
  assert.deepEqual(s.winners, [0]);
  assert.equal(s.why, 'points');
  assert.ok(s.players[0].vp >= 20 && s.turnNo <= 11, 'won on turn ' + s.turnNo + ' with ' + s.players[0].vp);
});

test('the guided game is won whatever the computers decide (40 streams, 6 monsters picked, other choices)', () => {
  for (let shift = 0; shift < 40; shift++) {
    const variants = [{}, { buy: false }, { stay2: true }, { buy: false, stay2: true }];
    const v = Object.assign({ shift, monster: shift % 6 }, variants[shift % 4]);
    const { s, seen } = playTut(v);
    assert.ok(seen.minHp >= 1, 'stream ' + shift + ': knocked out');
    assert.deepEqual(s.winners, [0], 'stream ' + shift + ' ' + JSON.stringify(v) + ': winners ' + s.winners + ' on turn ' + s.turnNo + ', vp ' + s.players.map(p => p.vp));
    assert.ok(s.turnNo <= 11, 'stream ' + shift + ': won late, turn ' + s.turnNo);
  }
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
  assert.ok(st.length >= 24);
  for (const s of st) assert.ok((s.text || s.html || '').length > 5);
  for (const s of st) if (s.text) assert.ok(s.text.split(/\s+/).length <= 40, 'too long: ' + s.text);
});
