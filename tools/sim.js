// Play computer-only games headless. Used by tests and the strength measurements.
//   const { playGame } = require('./sim.js'); playGame({ n, levels, seed, edition })
const { game } = require('../js/game.js');

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function playGame({ n = 4, levels, seed = 1, edition = '2016', copy = false, onStep, maxSteps = 20000 } = {}) {
  const rng = mulberry(seed);
  const seats = Array.from({ length: n }, (_, i) => ({ kind: 'computer', name: 'C' + (i + 1) }));
  let s = game.setup(n, { edition, levels: levels || Array(n).fill('hard') }, rng, seats);
  let steps = 0;
  while (!game.isOver(s)) {
    const toAct = game.toAct(s);
    if (!toAct.length) throw new Error('nobody to act');
    const seat = toAct[0];
    const ctx = { pub: game.publicView(s), mine: game.privateView(s, seat), state: s };
    const a = game.bot(ctx, seat, rng);
    if (onStep) onStep(s, seat, a);
    s = game.apply(copy ? JSON.parse(JSON.stringify(s)) : s, seat, copy ? JSON.parse(JSON.stringify(a)) : a, rng);
    if (++steps > maxSteps) throw new Error('runaway game');
  }
  return { s, steps };
}
module.exports = { playGame, mulberry };
