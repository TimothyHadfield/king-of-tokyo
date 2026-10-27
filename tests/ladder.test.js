// The level ladder holds head to head: Hard beats Medium and Medium beats Easy, one-on-one.
// Fixed seeds, so the result is the same every run.   Run: node --test tests/ladder.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { playGame } = require('../tools/sim.js');

function duel(a, b, n, seed0) {
  let w = 0;
  for (let g = 0; g < n; g++) {
    const seat = g % 2; const levels = [b, b]; levels[seat] = a;
    const { s } = playGame({ n: 2, levels, seed: seed0 + g });
    if (s.winners.includes(seat)) w += 1 / s.winners.length;
  }
  return w / n;
}

test('Hard beats Medium at least 65% one-on-one (1000 games)', () => {
  const r = duel('hard', 'medium', 1000, 310000);
  assert.ok(r >= 0.65, 'Hard vs Medium ' + (r * 100).toFixed(1) + '%');
});
test('Medium beats Easy one-on-one, and Hard beats Easy by more (600 games)', () => {
  const me = duel('medium', 'easy', 600, 320000), he = duel('hard', 'easy', 600, 330000);
  assert.ok(me >= 0.55, 'Medium vs Easy ' + (me * 100).toFixed(1) + '%');
  assert.ok(he > me, 'Hard vs Easy ' + (he * 100).toFixed(1) + '% should beat Medium vs Easy ' + (me * 100).toFixed(1) + '%');
});
