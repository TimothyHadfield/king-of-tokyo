// The whole level ladder, head to head (2 players, seats alternate) and one seat against three of the level below.
//   node tools/ladder.js [games=600]
// Prints Hard vs Medium, Medium vs Easy, Hard vs Easy (1-on-1) and Hard / Medium as one seat vs three of the level below.
const { playGame } = require('./sim.js');
const N = +process.argv[2] || 600;
const pct = x => (Math.round(x * 1000) / 10) + '%';
function duel(a, b, seed0) {
  let w = 0;
  for (let g = 0; g < N; g++) {
    const seat = g % 2; const levels = [b, b]; levels[seat] = a;
    const { s } = playGame({ n: 2, levels, seed: seed0 + g });
    if (s.winners.includes(seat)) w += 1 / s.winners.length;
  }
  return w / N;
}
function table(a, b, seed0) {
  let w = 0;
  for (let g = 0; g < N; g++) {
    const seat = g % 4; const levels = [b, b, b, b]; levels[seat] = a;
    const { s } = playGame({ n: 4, levels, seed: seed0 + g * 7 });
    if (s.winners.includes(seat)) w += 1 / s.winners.length;
  }
  return w / N;
}
const t0 = Date.now();
console.log('games each:', N);
console.log('hard vs medium 1-on-1:', pct(duel('hard', 'medium', 310000)));
console.log('medium vs easy 1-on-1:', pct(duel('medium', 'easy', 320000)));
console.log('hard vs easy 1-on-1:  ', pct(duel('hard', 'easy', 330000)));
console.log('hard vs 3 medium:     ', pct(table('hard', 'medium', 340000)), '(fair share 25%)');
console.log('medium vs 3 easy:     ', pct(table('medium', 'easy', 350000)), '(fair share 25%)');
console.log('seconds:', Math.round((Date.now() - t0) / 1000));
