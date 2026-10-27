// Measures the computers and the cards by playing many headless games, then writes js/strength-data.js.
//   node tools/measure-levels.js [gamesPerLevel=400] [cardGames=1500]
// 1. Each level's win rate as ONE seat against three Medium computers (4 players; 25% = as good as Medium).
// 2. Head to head (2 players): Hard vs Easy, Hard vs Medium, Medium vs Easy.
// 3. Card win %: in all-Easy 4-player games, how often a monster that bought a card went on to win. Easy buys an
//    affordable card at random, so every card gets tried by all kinds of monsters (since 2026-10-27; Hard now keeps
//    little energy and Medium skips many cards, so their games left half the cards without enough buys).
//    Buys in the game's last round (the final 4 turns) are left out: those are mostly points bought to finish.
// 4. Claw rate: share of final dice showing a claw (rollers outside an occupied Tokyo, all-Medium games), for the knock-out odds (CFG.claw in bots.js).
const fs = require('fs');
const path = require('path');
const { playGame } = require('./sim.js');

const per = +process.argv[2] || 400;
const cardGames = +process.argv[3] || 1500;
const t0 = Date.now();
const pct = x => Math.round(x * 1000) / 10;

const rates = {};
// claws rolled by monsters outside Tokyo while someone holds it (what the Tokyo monster must survive),
// counted in the all-Medium games (Medium is the default level)
let claws = 0, dice = 0, turns = 0;
const countClaws = (st, seat, a) => { if (st.ask && st.ask.type === 'roll' && a.t === 'done' && st.tokyo.city >= 0 && st.tokyo.city !== seat && st.tokyo.bay !== seat) { for (const d of st.t.dice) { dice++; if (d.f === 'C') claws++; } turns++; } };
for (const lvl of ['easy', 'medium', 'hard']) {
  let wins = 0;
  for (let g = 0; g < per; g++) {
    const seat = g % 4;
    const levels = ['medium', 'medium', 'medium', 'medium']; levels[seat] = lvl;
    const { s } = playGame({ n: 4, levels, seed: 50000 + g * 13 + (lvl === 'easy' ? 1 : lvl === 'hard' ? 2 : 3), onStep: lvl === 'medium' ? countClaws : undefined });
    if (s.winners.includes(seat)) wins += 1 / s.winners.length;
  }
  rates[lvl] = wins / per;
  console.log(lvl, 'vs 3 Medium:', pct(rates[lvl]) + '%');
}
function duel(a, b, seed0) {
  let w = 0;
  for (let g = 0; g < per; g++) {
    const seat = g % 2; const levels = [b, b]; levels[seat] = a;
    const { s } = playGame({ n: 2, levels, seed: seed0 + g });
    if (s.winners.includes(seat)) w += 1 / s.winners.length;
  }
  return w / per;
}
const hvE = duel('hard', 'easy', 90000), hvM = duel('hard', 'medium', 91000), mvE = duel('medium', 'easy', 92000);
console.log('1-on-1: hard vs easy', pct(hvE) + '%, hard vs medium', pct(hvM) + '%, medium vs easy', pct(mvE) + '%');

// cards from all-Easy games
const owned = {}, won = {};
for (let g = 0; g < cardGames; g++) {
  const had = [new Map(), new Map(), new Map(), new Map()]; // card -> turn first bought
  const { s } = playGame({
    n: 4, levels: ['easy', 'easy', 'easy', 'easy'], seed: 200000 + g,
    onStep(st, seat, a) {
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
  rates: { easy: Math.round(rates.easy * 1000) / 1000, medium: Math.round(rates.medium * 1000) / 1000, hard: Math.round(rates.hard * 1000) / 1000, hardVsEasy: Math.round(hvE * 1000) / 1000, hardVsMedium: Math.round(hvM * 1000) / 1000, mediumVsEasy: Math.round(mvE * 1000) / 1000 },
  levels: {
    easy: `Easy wins ${pct(rates.easy)}% against three Medium computers.`,
    medium: `Medium wins ${pct(rates.medium)}% (a fair share is 25%), and beats Easy ${pct(mvE)}% one-on-one.`,
    hard: `Hard wins ${pct(rates.hard)}%, and beats Medium ${pct(hvM)}% and Easy ${pct(hvE)}% one-on-one.`,
  },
  cards, claw,
};
const out = '// Filled in by tools/measure-levels.js (measured, not guessed). Do not edit by hand.\n'
  + 'var KotStrength = ' + JSON.stringify(data) + ';\n'
  + "if (typeof module === 'object' && module.exports) module.exports = KotStrength;\n";
fs.writeFileSync(path.join(__dirname, '..', 'js', 'strength-data.js'), out);
console.log('wrote js/strength-data.js in', data.measured.seconds, 's');
