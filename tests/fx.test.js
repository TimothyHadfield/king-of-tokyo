// Sound & effects: which events (and which sounds) each real engine step produces.
// Drives the real rules engine through a scripted short game and checks js/fx-events.js.   Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const KF = require('../js/fx-events.js');
require('../js/fx.js'); // sets globalThis.FX (no audio in node: play() just returns false)
const { mulberry, playGame } = require('../tools/sim.js');

const humans = n => Array.from({ length: n }, (_, i) => ({ kind: 'human', name: 'P' + i }));
const names = (evs, me) => KF.plan(evs, me, 1).map(p => p.snd);
const count = (arr, x) => arr.filter(y => y === x).length;

test('scripted 2-monster game: every step makes the right sounds', () => {
  const rng = mulberry(7);
  const s = E.setup(2, { edition: '2016' }, rng, humans(2));
  const A = s.cur, B = 1 - A, me = A;
  let prev = E.publicView(s);
  const step = fn => { fn(); const b = E.publicView(s); const evs = KF.events(prev, b, me); prev = b; return evs; };

  // 1. A throws six dice: one throw + one landing per die
  let evs = step(() => E.apply(s, A, { t: 'roll' }, rng));
  let snd = names(evs, me);
  assert.deepEqual(evs.find(x => x.e === 'roll').idx.length, 6);
  assert.equal(count(snd, 'diceRoll'), 6);
  assert.equal(count(snd, 'diceLand'), 6);
  // landings come after their throws, in die order
  const plan = KF.plan(evs, me, 1).filter(p => p.snd === 'diceLand').map(p => p.at);
  assert.deepEqual(plan, [300, 340, 380, 420, 460, 500]);

  // 2. keeps claws + energy + 3s: enters empty Tokyo (roar), energy (zap), points (star)
  evs = step(() => { s.t.dice = ['C', 'C', 'E', 'E', '3', '3'].map(f => ({ f, k: false })); E.apply(s, A, { t: 'done' }, rng); });
  snd = names(evs, me);
  assert.ok(snd.includes('roar'), 'enter Tokyo roars: ' + snd);
  assert.ok(snd.includes('zap'), 'energy zaps: ' + snd);
  assert.ok(snd.includes('star'), 'points sparkle: ' + snd);
  assert.equal(s.tokyo.city, A);

  // 3. buys a card: coins, the card slides over, a new card is dealt
  evs = step(() => { s.players[A].en = 20; s.market[0] = 'apartment-building'; E.apply(s, A, { t: 'buy', i: 0 }, rng); });
  snd = names(evs, me);
  for (const x of ['coins', 'cardDeal', 'cardFlip', 'star']) assert.ok(snd.includes(x), x + ' on buy: ' + snd);

  // 4. ends the turn: the computer's turn starts, no "your turn" chime
  evs = step(() => E.apply(s, A, { t: 'end' }, rng));
  assert.ok(evs.some(x => x.e === 'turn' && !x.mine));
  assert.ok(!names(evs, me).includes('turn'));

  // 5. B rolls six claws at A in Tokyo: smash, and A is asked to stay or leave (alert)
  step(() => E.apply(s, B, { t: 'roll' }, rng));
  evs = step(() => { s.t.dice = Array.from({ length: 6 }, () => ({ f: 'C', k: false })); E.apply(s, B, { t: 'done' }, rng); });
  snd = names(evs, me);
  assert.ok(snd.includes('smash'), 'claws smash: ' + snd);
  assert.ok(evs.some(x => x.e === 'dmg' && x.s === A && x.n === 6));
  assert.ok(evs.some(x => x.e === 'ask' && x.type === 'yield'), 'yield asked of me');
  assert.ok(snd.includes('turn'), 'a quiet alert when a decision becomes mine');

  // 6. A leaves Tokyo (whoosh), B goes in (roar)
  evs = step(() => E.apply(s, A, { t: 'yield', leave: true }, rng));
  snd = names(evs, me);
  assert.ok(snd.includes('whoosh') && snd.includes('roar'), 'leave + enter: ' + snd);

  // 7. B ends; my turn: the chime
  evs = step(() => E.apply(s, B, { t: 'end' }, rng));
  assert.ok(names(evs, me).includes('turn'), 'your-turn chime');

  // 8. A knocks out B: explosion and game over (I win)
  step(() => E.apply(s, A, { t: 'roll' }, rng));
  evs = step(() => { s.players[B].hp = 2; s.t.dice = ['C', 'C', 'C', '1', '2', 'H'].map(f => ({ f, k: false })); E.apply(s, A, { t: 'done' }, rng); });
  snd = names(evs, me);
  assert.ok(snd.includes('explosion'), 'knock-out explodes: ' + snd);
  const over = evs.find(x => x.e === 'over');
  assert.ok(over && over.mine && over.why === 'last', 'game over, mine: ' + JSON.stringify(over));
  // and from B's side it is a loss
  assert.equal(KF.events(prev, prev, B).length, 0, 'the same snapshot twice plays nothing');
});

test('reload / first view plays nothing (except the very first "your turn")', () => {
  const rng = mulberry(3);
  const s = E.setup(3, {}, rng, humans(3));
  const v = E.publicView(s);
  assert.deepEqual(KF.events(null, v, (s.cur + 1) % 3), []);
  assert.deepEqual(KF.events(null, v, s.cur).map(x => x.e), ['turn']);
  E.apply(s, s.cur, { t: 'roll' }, rng);
  assert.deepEqual(KF.events(null, E.publicView(s), s.cur), [], 'mid-turn resume is silent');
});

test('every sound the game asks for exists, over full computer games', () => {
  KF.defineSounds(globalThis.FX);
  const have = new Set(globalThis.FX.sounds);
  const used = new Set();
  for (let seed = 1; seed <= 6; seed++) {
    let prev = null;
    playGame({ n: 2 + (seed % 5), seed, onStep: st => { const v = E.publicView(st); for (const p of KF.plan(KF.events(prev, v, 0), 0, 1)) used.add(p.snd); prev = v; } });
  }
  for (const n of used) assert.ok(have.has(n), 'missing sound ' + n);
  for (const n of ['diceRoll', 'diceLand', 'smash', 'roar', 'zap', 'heal', 'star', 'coins', 'cardDeal']) assert.ok(used.has(n), 'never heard ' + n);
  for (const n of ['roar', 'smash', 'heal', 'zap', 'star']) assert.equal(globalThis.FX.soundCategory(n), 'moves');
});
