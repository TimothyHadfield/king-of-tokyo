// Measures the computers and the cards by playing many headless games, then writes js/strength-data.js.
//   node tools/measure-levels.js [gamesPerLevel=400] [cardGames=1500]
// 1. Each level's win rate as ONE seat against three Medium computers (4 players; 25% = as good as Medium).
// 2. Hard vs Easy head to head (2 players).
// 3. Card win %: in all-Hard 4-player games, how often a monster that bought a card went on to win.
//    Buys in the game's last round (the final 4 turns) are left out: those are mostly points bought to finish.
// 4. Claw rate: share of final dice showing a claw (rollers outside an occupied Tokyo), for the knock-out odds (CLAW_PER_DIE in bots.js).
const fs = require('fs');
const path = require('path');
const { playGame } = require('./sim.js');

const per = +process.argv[2] || 400;
const cardGames = +process.argv[3] || 1500;
const t0 = Date.now();
const pct = x => Math.round(x * 1000) / 10;

const rates = {};
for (const lvl of ['easy', 'medium', 'hard']) {
  let wins = 0;
  for (let g = 0; g < per; g++) {
    const seat = g % 4;
    const levels = ['medium', 'medium', 'medium', 'medium']; levels[seat] = lvl;
    const { s } = playGame({ n: 4, levels, seed: 50000 + g * 13 + (lvl === 'easy' ? 1 : lvl === 'hard' ? 2 : 3) });
    if (s.winners.includes(seat)) wins += 1 / s.winners.length;
  }
  rates[lvl] = wins / per;
  console.log(lvl, 'vs 3 Medium:', pct(rates[lvl]) + '%');
}
let hvE = 0;
for (let g = 0; g < per; g++) {
  const seat = g % 2; const levels = ['easy', 'easy']; levels[seat] = 'hard';
  const { s } = playGame({ n: 2, levels, seed: 90000 + g });
  if (s.winners.includes(seat)) hvE += 1 / s.winners.length;
}
hvE /= per;
console.log('hard vs easy 1-on-1:', pct(hvE) + '%');

// cards and claws from all-Hard games
const owned = {}, won = {};
let claws = 0, dice = 0, turns = 0;
for (let g = 0; g < cardGames; g++) {
  const had = [new Map(), new Map(), new Map(), new Map()]; // card -> turn first bought
  const { s } = playGame({
    n: 4, levels: ['hard', 'hard', 'hard', 'hard'], seed: 200000 + g,
    onStep(st, seat, a) {
      // claws rolled by monsters outside Tokyo while someone holds it: what the Tokyo monster must survive
      if (st.ask && st.ask.type === 'roll' && a.t === 'done' && st.tokyo.city >= 0 && st.tokyo.city !== seat && st.tokyo.bay !== seat) { for (const d of st.t.dice) { dice++; if (d.f === 'C') claws++; } turns++; }
      if (st.ask && (st.ask.type === 'buy' || st.ask.type === 'opp')) {
        let id = null;
        if (a.t === 'buy' && st.ask.type === 'buy') id = st.market[a.i];
        else if (a.t === 'buy') id = st.market[st.ask.i];
        else if (a.t === 'top') id = st.deck[st.deck.length - 1];
        if (id && !had[seat].has(id)) had[seat].set(id, st.turnNo);
      }
    },
  });
  for (let i = 0; i < 4; i++) for (const [id, turn] of had[i]) {
    if (s.turnNo - turn < 4) continue;
    owned[id] = (owned[id] || 0) + 1;
    if (s.winners.includes(i)) won[id] = (won[id] || 0) + 1 / s.winners.length;
  }
}
const cards = {};
for (const id of Object.keys(owned)) if (owned[id] >= 30) cards[id] = { win: Math.round((won[id] || 0) / owned[id] * 1000) / 1000, n: owned[id] };
const claw = Math.round(claws / dice * 1000) / 1000;
console.log('claw share of final dice:', claw, 'over', turns, 'turns; cards with 30+ buys:', Object.keys(cards).length);

const data = {
  measured: { date: new Date().toISOString().slice(0, 10), games: per, cardGames, edition: '2016', seconds: Math.round((Date.now() - t0) / 1000) },
  rates: { easy: Math.round(rates.easy * 1000) / 1000, medium: Math.round(rates.medium * 1000) / 1000, hard: Math.round(rates.hard * 1000) / 1000, hardVsEasy: Math.round(hvE * 1000) / 1000 },
  levels: {
    easy: `Easy wins ${pct(rates.easy)}% against three Medium computers.`,
    medium: `Medium wins ${pct(rates.medium)}% (a fair share is 25%).`,
    hard: `Hard wins ${pct(rates.hard)}%, and beats Easy ${pct(hvE)}% of the time one-on-one.`,
  },
  cards, claw,
};
const out = '// Filled in by tools/measure-levels.js (measured, not guessed). Do not edit by hand.\n'
  + 'var KotStrength = ' + JSON.stringify(data) + ';\n'
  + "if (typeof module === 'object' && module.exports) module.exports = KotStrength;\n";
fs.writeFileSync(path.join(__dirname, '..', 'js', 'strength-data.js'), out);
console.log('wrote js/strength-data.js in', data.measured.seconds, 's');
