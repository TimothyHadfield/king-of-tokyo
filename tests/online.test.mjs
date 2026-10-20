// The King of Tokyo engine behind the shared online module's game interface (_online/README.md).
// Run: node tests/online.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createLocal } from '../js/online.js';
const require = createRequire(import.meta.url);
const { game } = require('../js/game.js');
const { mulberry } = require('../tools/sim.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };
const humans = n => Array.from({ length: n }, (_, i) => ({ kind: 'human', name: 'P' + (i + 1) }));
const clone = x => JSON.parse(JSON.stringify(x));

// 1. Every move through JSON copies (the online path): state survives JSON, bots never make an illegal move.
{
  let games = 0, moves = 0;
  for (let g = 0; g < 30; g++) {
    const rng = mulberry(g + 11);
    const n = 2 + (g % 5);
    let s = game.setup(n, { edition: g % 3 === 2 ? '2011' : '2016', level: ['easy', 'medium', 'hard'][g % 3] }, rng, humans(n));
    assert.equal(JSON.stringify(clone(s)), JSON.stringify(s), 'state survives JSON');
    while (!game.isOver(s)) {
      const toAct = game.toAct(s);
      assert.ok(toAct.length >= 1, 'somebody must be asked');
      const seat = toAct[0];
      const ctx = { pub: game.publicView(s), mine: game.privateView(s, seat), state: s };
      s = game.apply(clone(s), seat, clone(game.bot(ctx, seat, rng)), rng);
      assert.equal(JSON.stringify(clone(s)), JSON.stringify(s));
      assert.ok(++moves < 400000, 'runaway');
    }
    assert.deepEqual(game.toAct(s), []);
    games++;
  }
  ok(games + ' online-path games (2-6 seats, both editions) end cleanly; ' + moves + ' moves, no illegal bot move');
}

// 2. Illegal moves throw (online.js drops them).
{
  const rng = mulberry(3);
  const s = game.setup(3, {}, rng, humans(3));
  const seat = game.toAct(s)[0], other = (seat + 1) % 3;
  assert.throws(() => game.apply(clone(s), other, { t: 'roll' }, rng), /Not your decision/);
  assert.throws(() => game.apply(clone(s), seat, null, rng), /Bad move/);
  assert.throws(() => game.apply(clone(s), seat, {}, rng), /Bad move/);
  assert.throws(() => game.apply(clone(s), seat, { t: 'buy', i: 0 }, rng));
  const r = clone(s); game.apply(r, seat, { t: 'roll' }, rng);
  assert.throws(() => game.apply(clone(r), seat, { t: 'reroll', keep: [0, 0] }, rng), /Bad dice/);
  assert.throws(() => game.apply(clone(r), seat, { t: 'reroll', keep: [0, 1, 2, 3, 4, 5] }, rng), /at least one/);
  assert.throws(() => game.apply(clone(r), seat, { t: 'change', i: 0, f: '1', via: 'herd' }, rng), /Herd Culler/);
  ok('moves out of turn, malformed moves and card abilities you lack all throw');
}

// 3. Secrecy: the public view never shows the deck order; Made in a Lab shows the top card to its owner only, while buying.
{
  const rng = mulberry(7);
  let s = game.setup(3, {}, rng, humans(3));
  const pubJ = JSON.stringify(game.publicView(s));
  assert.ok(!pubJ.includes('"deck"'), 'no deck in the public view');
  assert.equal(game.publicView(s).deckSize, 63);
  for (let j = 0; j < 3; j++) assert.deepEqual(game.privateView(s, j), {});
  // play to someone's buy step, then give them Made in a Lab
  while (!(s.ask && s.ask.type === 'buy')) { const seat = game.toAct(s)[0]; s = game.apply(s, seat, game.bot({ state: s }, seat, rng), rng); }
  const b = s.ask.seats[0];
  s.players[b].cards.push({ id: 'made-in-a-lab', k: 999 });
  assert.equal(game.privateView(s, b).top, s.deck[s.deck.length - 1]);
  for (let j = 0; j < 3; j++) if (j !== b) assert.deepEqual(game.privateView(s, j), {});
  ok('deck order hidden; Made in a Lab top card visible to its owner only');
}

// 4. Computer seats picked before the start: their level is kept per seat.
{
  const rng = mulberry(9);
  const s = game.setup(4, { level: 'easy', levels: ['easy', 'hard', 'medium', 'hard'] }, rng,
    [{ kind: 'human', name: 'A' }, { kind: 'computer', name: 'Computer 2' }, { kind: 'human', name: 'B' }, { kind: 'computer', name: 'Computer 4' }]);
  assert.equal(s.players[1].lvl, 'hard'); assert.equal(s.players[3].lvl, 'hard');
  assert.notEqual(s.players[1].name, 'Computer 2', 'computers take their monster name');
  ok('per-seat computer levels and monster names');
}

// 5. A local room (createLocal) plays a human + 3 computers to "finished".
{
  const room = createLocal({ game, seats: ['human', 'computer', 'computer', 'computer'], options: { level: 'hard' }, botDelayMs: 0, rng: mulberry(21) });
  let last = null;
  room.on('change', snap => { last = snap; });
  room.on('error', e => { throw e; });
  room.start();
  let guard = 0;
  while (last.status !== 'finished') {
    if (!last.myTurn) { await new Promise(r => setTimeout(r, 1)); assert.ok(++guard < 200000); continue; }
    const r = room.act(game.bot({ state: room.state }, last.mySeat, Math.random));
    assert.ok(r.ok, r.message);
    assert.ok(++guard < 200000);
  }
  assert.ok(last.pub.over);
  room.close && room.close();
  ok('createLocal room plays to finished');
}

// 6. Junk options fall back to safe defaults.
{
  const s = game.setup(9, { edition: 'x', level: 'god', bay: 'maybe', monsters: [99, -1, 'a'] }, mulberry(1), humans(9));
  assert.equal(s.players.length, 6);
  assert.equal(s.edition, '2016');
  assert.equal(s.level, 'medium');
  assert.equal(new Set(s.players.map(p => p.mon)).size, 6);
  ok('junk options give a valid game');
}

console.log(pass + ' passed');
