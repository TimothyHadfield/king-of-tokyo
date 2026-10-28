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

test('Medium computers spend their energy on cards (not sitting on 8 ⚡ all game)', () => {
  const { playGame } = require('../tools/sim.js');
  let buys = 0, en = 0;
  const G = 100;
  for (let g = 0; g < G; g++) {
    const { s } = playGame({ n: 4, levels: ['medium', 'medium', 'medium', 'medium'], seed: 880000 + g, onStep: (st, seat, a) => { if (a.t === 'buy' || a.t === 'top' || a.t === 'sweep') buys++; } });
    en += s.players.reduce((a, p) => a + p.en, 0) / 4;
  }
  assert.ok(buys / G >= 3, 'cards bought per game: ' + (buys / G).toFixed(1));
  assert.ok(en / G <= 5, 'energy left at the end: ' + (en / G).toFixed(1));
});

test('with evolutions on, the ladder still holds and the computers do play them (400 games each)', () => {
  let used = 0;
  const duelE = (a, b, n, seed0) => {
    let w = 0;
    for (let g = 0; g < n; g++) {
      const seat = g % 2; const levels = [b, b]; levels[seat] = a;
      const { s } = playGame({ n: 2, levels, seed: seed0 + g, evo: true });
      used += s.players.reduce((t, p) => t + (p.ex ? p.ex.length + p.evo.length : 0), 0);
      if (s.winners.includes(seat)) w += 1 / s.winners.length;
    }
    return w / n;
  };
  const hm = duelE('hard', 'medium', 400, 410000), me = duelE('medium', 'easy', 400, 420000), he = duelE('hard', 'easy', 400, 430000);
  assert.ok(used > 400, 'evolutions played: ' + used);
  assert.ok(hm >= 0.65, 'Hard vs Medium ' + (hm * 100).toFixed(1) + '%');
  assert.ok(me >= 0.55, 'Medium vs Easy ' + (me * 100).toFixed(1) + '%');
  assert.ok(he > me, 'Hard vs Easy ' + (he * 100).toFixed(1) + '% vs Medium vs Easy ' + (me * 100).toFixed(1) + '%');
});
