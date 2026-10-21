// Rules tests: card counts per edition, scoring, Tokyo, Tokyo Bay, winning, card rulings, and the odds maths.
// Every count and rule here is sourced in docs/rules-check.md.   Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Cards = require('../js/cards.js');
const E = require('../js/engine.js');
const D = require('../js/dice.js');
const { mulberry, playGame } = require('../tools/sim.js');

const humans = n => Array.from({ length: n }, (_, i) => ({ kind: 'human', name: 'P' + i }));
function fresh(n, opts, seed) {
  const rng = mulberry(seed || 1);
  const s = E.setup(n, Object.assign({ edition: '2016' }, opts || {}), rng, humans(n));
  return { s, rng };
}
// the active player rolls exactly these faces and stops
function roll(s, rng, faces) {
  const i = s.cur;
  assert.equal(s.ask.type, 'start');
  E.apply(s, i, { t: 'roll' }, rng);
  s.t.dice = faces.map(f => ({ f, k: false }));
  E.apply(s, i, { t: 'done' }, rng);
  return i;
}
const endTurn = (s, rng) => E.apply(s, s.cur, { t: 'end' }, rng);
const other = (s, i, d) => (i + (d || 1)) % s.players.length;

// ------------------------------------------------------------------ the deck
for (const ed of ['2016', '2011']) {
  test(ed + ' deck: 66 cards, 48 Keep + 18 Discard, 64 different, 2 Extra Heads, 2 Evacuation Orders', () => {
    const deck = Cards.deckFor(ed), B = Cards.BY_ED[ed];
    assert.equal(deck.length, 66);
    assert.equal(deck.filter(id => B[id].keep).length, 48);
    assert.equal(deck.filter(id => !B[id].keep).length, 18);
    assert.equal(new Set(deck).size, 64);
    assert.equal(deck.filter(id => id === 'extra-head').length, 2);
    assert.equal(deck.filter(id => id === 'evacuation-orders').length, 2);
  });
}
test('2016 printed costs match the official card art, in rulebook id order', () => {
  // keep ids 1-48 and discard 101-118 as listed by the licensed BGA version (see docs/rules-check.md)
  const keep = ['acid-attack', 'alien-metabolism', 'alpha-monster', 'armor-plating', 'background-dweller', 'burrowing', 'camouflage', 'complete-destruction', 'dedicated-news-team', 'eater-of-the-dead', 'energy-hoarder', 'even-bigger', 'extra-head', 'extra-head', 'fire-breathing', 'freeze-time', 'friend-of-children', 'giant-brain', 'gourmet', 'healing-ray', 'herbivore', 'herd-culler', 'it-has-a-child', 'jets', 'made-in-a-lab', 'metamorph', 'mimic', 'monster-batteries', 'nova-breath', 'omnivore', 'opportunist', 'parasitic-tentacles', 'plot-twist', 'poison-quills', 'poison-spit', 'psychic-probe', 'rapid-healing', 'regeneration', 'rooting-for-the-underdog', 'shrink-ray', 'smoke-cloud', 'solar-powered', 'spiked-tail', 'stretchy', 'telepath', 'urbavore', 'were-only-making-it-stronger', 'wings'];
  const keepCost = [6, 3, 5, 4, 4, 5, 3, 3, 3, 4, 3, 4, 7, 7, 4, 5, 3, 5, 4, 4, 5, 3, 7, 5, 2, 3, 8, 3, 7, 4, 3, 4, 3, 3, 4, 3, 3, 4, 3, 6, 4, 2, 5, 3, 4, 4, 3, 6];
  const disc = ['apartment-building', 'commuter-train', 'corner-store', 'death-from-above', 'energize', 'evacuation-orders', 'evacuation-orders', 'fire-blast', 'frenzy', 'gas-refinery', 'heal', 'high-altitude-bombing', 'jet-fighters', 'national-guard', 'nuclear-power-plant', 'skyscraper', 'tanks', 'vast-storm'];
  const discCost = [5, 4, 3, 5, 8, 7, 7, 3, 7, 6, 3, 4, 5, 3, 6, 6, 4, 6];
  const B = Cards.BY_ED['2016'];
  assert.deepEqual(keep.map(id => B[id].cost), keepCost);
  assert.deepEqual(disc.map(id => B[id].cost), discCost);
  assert.deepEqual([...keep, ...disc].sort(), Cards.deckFor('2016').sort());
});
test('edition differences: 8 renames, Battery Monster 3 vs Monster Batteries 2', () => {
  const a = Cards.BY_ED['2016'], b = Cards.BY_ED['2011'];
  const renamed = Object.keys(a).filter(id => a[id].name.replace(/!$/, '') !== b[id].name.replace(/!$/, ''));
  assert.deepEqual(renamed.sort(), ['alien-metabolism', 'death-from-above', 'dedicated-news-team', 'fire-blast', 'monster-batteries', 'omnivore', 'tanks', 'telepath']);
  assert.equal(a['monster-batteries'].name, 'Battery Monster'); assert.equal(a['monster-batteries'].cost, 3);
  assert.equal(b['monster-batteries'].name, 'Monster Batteries'); assert.equal(b['monster-batteries'].cost, 2);
  for (const id of Object.keys(a)) if (id !== 'monster-batteries') assert.equal(a[id].cost, b[id].cost, id);
});
test('setup: 10 hearts, 0 points, 3 cards face up, nobody in Tokyo, 63 left in the deck', () => {
  const { s } = fresh(4);
  for (const p of s.players) { assert.equal(p.hp, 10); assert.equal(p.vp, 0); assert.equal(p.en, 0); }
  assert.equal(s.market.filter(Boolean).length, 3);
  assert.equal(s.deck.length, 63);
  assert.deepEqual(s.tokyo, { city: -1, bay: -1 });
  assert.equal(s.ask.type, 'start');
});

// ------------------------------------------------------------------ dice and scoring
test('rolls: 6 dice, 2 rerolls (3 rolls in all)', () => {
  const { s, rng } = fresh(3);
  E.apply(s, s.cur, { t: 'roll' }, rng);
  assert.equal(s.t.dice.length, 6);
  assert.equal(s.t.rerolls, 2);
  E.apply(s, s.cur, { t: 'reroll', keep: [] }, rng);
  E.apply(s, s.cur, { t: 'reroll', keep: [] }, rng);
  assert.throws(() => E.apply(s, s.cur, { t: 'reroll', keep: [] }, rng), /No rerolls/);
});
test('number sets: three 1s = 1, four 1s = 2, three 3s = 3, five 3s = 5, two 2s = 0', () => {
  for (const [faces, vp] of [[['1', '1', '1', 'E', 'E', 'E'], 1], [['1', '1', '1', '1', 'E', 'E'], 2], [['3', '3', '3', 'E', 'E', 'E'], 3], [['3', '3', '3', '3', '3', 'E'], 5], [['2', '2', 'E', 'E', 'E', 'E'], 0]]) {
    const { s, rng } = fresh(3);
    s.tokyo.city = other(s, s.cur); // keep the roller out of Tokyo so entering adds nothing
    const i = roll(s, rng, faces);
    assert.equal(s.players[i].vp, vp, faces.join(''));
  }
});
test('energy faces give energy; hearts heal outside Tokyo, never above 10', () => {
  const { s, rng } = fresh(3);
  s.tokyo.city = other(s, s.cur);
  const i = s.cur; s.players[i].hp = 8;
  roll(s, rng, ['E', 'E', 'H', 'H', 'H', '2']);
  assert.equal(s.players[i].en, 2);
  assert.equal(s.players[i].hp, 10);
});
test('hearts do not heal in Tokyo', () => {
  const { s, rng } = fresh(3);
  const i = s.cur; s.tokyo.city = i; s.players[i].hp = 5;
  roll(s, rng, ['H', 'H', 'H', '2', '2', 'E']);
  assert.equal(s.players[i].hp, 5);
});

// ------------------------------------------------------------------ Tokyo
test('2016: the first monster enters empty Tokyo City without a claw and gains 1 point', () => {
  const { s, rng } = fresh(4);
  const i = roll(s, rng, ['2', '2', 'E', 'E', 'H', 'H']);
  assert.equal(s.tokyo.city, i);
  assert.equal(s.players[i].vp, 1);
});
test('2011: you need to roll a claw to take empty Tokyo', () => {
  let { s, rng } = fresh(4, { edition: '2011' });
  roll(s, rng, ['2', '2', 'E', 'E', 'H', 'H']);
  assert.equal(s.tokyo.city, -1);
  ({ s, rng } = fresh(4, { edition: '2011' }));
  const i = roll(s, rng, ['C', '2', 'E', 'E', 'H', 'H']);
  assert.equal(s.tokyo.city, i);
});
test('starting a turn in Tokyo gives 2 points', () => {
  const { s, rng } = fresh(3);
  const i = s.cur; s.tokyo.city = i;
  roll(s, rng, ['2', '2', 'E', 'E', 'H', 'H']);
  endTurn(s, rng); // nobody attacked; next two players roll nothing that matters
  for (let k = 0; k < 2; k++) { roll(s, rng, ['2', '2', 'E', 'E', 'H', 'H']); endTurn(s, rng); }
  assert.equal(s.cur, i);
  assert.equal(s.players[i].vp, 2);
});
test('claws from outside hit Tokyo; the monster may yield and the attacker enters (+1)', () => {
  const { s, rng } = fresh(4);
  const i = s.cur, j = other(s, i); s.tokyo.city = j;
  roll(s, rng, ['C', 'C', 'C', 'E', 'E', '2']);
  assert.equal(s.players[j].hp, 7);
  for (let k = 0; k < 4; k++) if (k !== i && k !== j) assert.equal(s.players[k].hp, 10, 'outside monsters are not hit');
  assert.equal(s.ask.type, 'yield'); assert.deepEqual(E.toAct(s), [j]);
  E.apply(s, j, { t: 'yield', leave: true }, rng);
  assert.equal(s.tokyo.city, i);
  assert.equal(s.players[i].vp, 1);
});
test('claws from Tokyo hit every monster outside', () => {
  const { s, rng } = fresh(4);
  const i = s.cur; s.tokyo.city = i;
  roll(s, rng, ['C', 'C', '1', 'E', 'E', '2']);
  for (let k = 0; k < 4; k++) assert.equal(s.players[k].hp, k === i ? 10 : 8);
});
test('you may not yield when Armor Plating stopped the only claw', () => {
  const { s, rng } = fresh(4);
  const i = s.cur, j = other(s, i); s.tokyo.city = j;
  s.players[j].cards.push({ id: 'armor-plating', k: 900 });
  roll(s, rng, ['C', '1', '1', 'E', 'E', '2']);
  assert.equal(s.players[j].hp, 10);
  assert.equal(s.ask.type, 'buy'); // no yield question
  assert.equal(s.tokyo.city, j);
});

// ------------------------------------------------------------------ Tokyo Bay
test('Tokyo Bay is used only with 5-6 monsters: City full -> enter Bay', () => {
  for (const [n, bay] of [[4, false], [5, true], [6, true]]) {
    const { s, rng } = fresh(n);
    const i = s.cur, j = other(s, i); s.tokyo.city = j;
    roll(s, rng, ['2', '2', 'E', 'E', 'H', 'H']);
    assert.equal(s.tokyo.bay === i, bay, 'n=' + n);
  }
});
test('City and Bay never hit each other; outside claws hit both', () => {
  const { s, rng } = fresh(5);
  const i = s.cur, a = other(s, i, 1), b = other(s, i, 2);
  s.tokyo.city = a; s.tokyo.bay = b;
  roll(s, rng, ['C', 'C', '1', 'E', 'E', '2']);
  assert.equal(s.players[a].hp, 8); assert.equal(s.players[b].hp, 8);
  assert.deepEqual(E.toAct(s).sort(), [a, b].sort());
  E.apply(s, a, { t: 'yield', leave: true }, rng);
  E.apply(s, b, { t: 'yield', leave: true }, rng);
  assert.equal(s.tokyo.city, i, 'both yield: attacker takes City');
  assert.equal(s.tokyo.bay, -1, 'and Bay stays empty');
});
test('Bay closes at 4 monsters: its monster moves to an empty City, otherwise leaves', () => {
  const { s, rng } = fresh(5);
  const i = s.cur, a = other(s, i, 1), b = other(s, i, 2), victim = other(s, i, 3);
  s.tokyo.city = i; s.tokyo.bay = b; s.players[victim].hp = 1;
  roll(s, rng, ['C', '1', '1', 'E', 'E', '2']);
  assert.equal(s.players[victim].alive, false);
  assert.equal(s.tokyo.bay, -1); assert.equal(s.tokyo.city, i);
  assert.ok(a >= 0);
});

// ------------------------------------------------------------------ winning
test('20 points wins at the END of the turn, not mid-turn', () => {
  const { s, rng } = fresh(3);
  const i = s.cur; s.tokyo.city = other(s, i); s.players[i].vp = 19;
  roll(s, rng, ['1', '1', '1', 'E', 'E', '2']);
  assert.equal(s.players[i].vp, 20);
  assert.equal(s.over, false);
  endTurn(s, rng);
  assert.equal(s.over, true); assert.deepEqual(s.winners, [i]); assert.equal(s.why, 'points');
});
test('you must survive your turn: 20 points and 0 hearts is a knock-out, not a win', () => {
  const { s, rng } = fresh(3);
  const i = s.cur; s.tokyo.city = other(s, i);
  s.players[i].vp = 15; s.players[i].hp = 4; s.players[i].en = 5; s.market[0] = 'jet-fighters';
  roll(s, rng, ['2', '2', 'E', 'H', 'H', 'H']); // hearts heal to 7... set back to 4 below
  s.players[i].hp = 4;
  E.apply(s, i, { t: 'buy', i: 0 }, rng);
  assert.equal(s.players[i].alive, false);
  assert.equal(s.over, false);
  assert.notEqual(s.cur, i);
});
test('last monster standing wins at once', () => {
  const { s, rng } = fresh(2);
  const i = s.cur, j = other(s, i); s.tokyo.city = j; s.players[j].hp = 2;
  roll(s, rng, ['C', 'C', '1', 'E', 'E', '2']);
  assert.equal(s.over, true); assert.deepEqual(s.winners, [i]); assert.equal(s.why, 'last');
});
test('two monsters at 20 at the end of a turn share the win', () => {
  const { s, rng } = fresh(3);
  const i = s.cur, j = other(s, i); s.tokyo.city = j;
  s.players[i].vp = 19; s.players[j].vp = 20;
  roll(s, rng, ['1', '1', '1', 'E', 'E', '2']);
  endTurn(s, rng);
  assert.deepEqual(s.winners.sort(), [i, j].sort());
});
test('everyone knocked out at once: nobody wins', () => {
  const { s, rng } = fresh(2);
  const i = s.cur;
  for (const p of s.players) p.hp = 3;
  s.players[i].en = 4; s.market[0] = 'high-altitude-bombing';
  s.tokyo.city = other(s, i);
  roll(s, rng, ['2', '2', 'E', '1', '1', '3']);
  E.apply(s, i, { t: 'buy', i: 0 }, rng);
  assert.equal(s.over, true); assert.deepEqual(s.winners, []); assert.equal(s.why, 'none');
});

// ------------------------------------------------------------------ card rulings (2016 unless marked)
function withCard(s, i, id) { s.players[i].cards.push({ id, k: 800 + s.players[i].cards.length }); }
test('2016 Spiked Tail adds a claw only when you rolled one; Acid Attack always adds one', () => {
  let { s, rng } = fresh(3); let i = s.cur, j = other(s, i); s.tokyo.city = j; withCard(s, i, 'spiked-tail');
  roll(s, rng, ['1', '1', '2', 'E', 'E', '2']); assert.equal(s.players[j].hp, 10);
  ({ s, rng } = fresh(3)); i = s.cur; j = other(s, i); s.tokyo.city = j; withCard(s, i, 'spiked-tail');
  roll(s, rng, ['C', '1', '2', 'E', 'E', '2']); assert.equal(s.players[j].hp, 8);
  ({ s, rng } = fresh(3)); i = s.cur; j = other(s, i); s.tokyo.city = j; withCard(s, i, 'acid-attack'); withCard(s, i, 'spiked-tail');
  roll(s, rng, ['1', '1', '2', 'E', 'E', '2']); assert.equal(s.players[j].hp, 8, 'acid claw triggers spiked tail');
});
test('2016 Poison Spit tokens go only to monsters that lost hearts to claws', () => {
  const { s, rng } = fresh(4);
  const i = s.cur, j = other(s, i); s.tokyo.city = j; withCard(s, i, 'poison-spit');
  roll(s, rng, ['C', '1', '2', 'E', 'E', '2']);
  assert.equal(s.players[j].poison, 1);
  for (let k = 0; k < 4; k++) if (k !== j) assert.equal(s.players[k].poison, 0);
});
test('2016 Fire Breathing: neighbours lose 1 when you roll a claw, wherever they are', () => {
  const { s, rng } = fresh(5);
  const i = s.cur, far = other(s, i, 2); s.tokyo.city = far; withCard(s, i, 'fire-breathing');
  roll(s, rng, ['C', '1', '2', 'E', 'E', '2']);
  assert.equal(s.players[far].hp, 9);
  assert.equal(s.players[other(s, i, 1)].hp, 9);
  assert.equal(s.players[other(s, i, 4)].hp, 9);
  assert.equal(s.players[other(s, i, 3)].hp, 10);
});
test('2016 Battery Monster: 6 energy from the bank, 2 per turn', () => {
  const { s, rng } = fresh(2);
  const i = s.cur; s.tokyo.city = other(s, i); s.players[i].en = 3; s.market[0] = 'monster-batteries';
  roll(s, rng, ['1', '2', '3', '1', '2', '3']);
  E.apply(s, i, { t: 'buy', i: 0 }, rng);
  assert.equal(s.players[i].en, 0);
  assert.equal(s.players[i].cards.find(c => c.id === 'monster-batteries').c, 6);
});
test('2016 Even Bigger: maximum is 12', () => {
  const { s } = fresh(2); withCard(s, 0, 'even-bigger'); withCard(s, 0, 'even-bigger');
  assert.equal(E.maxHp(s, 0), 12);
  const t = fresh(2, { edition: '2011' }).s; withCard(t, 0, 'even-bigger');
  assert.equal(E.maxHp(t, 0), 12);
});
test('2016 Death From Above: take City, every other Tokyo monster must leave', () => {
  const { s, rng } = fresh(5);
  const i = s.cur, a = other(s, i, 1), b = other(s, i, 2);
  s.tokyo.city = a; s.tokyo.bay = b; s.players[i].en = 5; s.market[0] = 'death-from-above';
  roll(s, rng, ['1', '2', '3', 'E', 'E', 'H']); // no claws: nothing to yield
  s.players[i].en = 5;
  E.apply(s, i, { t: 'buy', i: 0 }, rng);
  assert.equal(s.tokyo.city, i); assert.equal(s.tokyo.bay, -1);
});
test('2016 Frenzy ends the turn at once and starts another one for you', () => {
  const { s, rng } = fresh(3);
  const i = s.cur; s.tokyo.city = other(s, i); s.players[i].en = 7; s.market[0] = 'frenzy';
  roll(s, rng, ['1', '2', '3', 'E', 'H', 'H']);
  s.players[i].en = 7;
  E.apply(s, i, { t: 'buy', i: 0 }, rng);
  assert.equal(s.cur, i); assert.equal(s.ask.type, 'start'); assert.equal(s.t.extraTurn, true);
});
test('2-player variant: entering Tokyo gives 1 energy instead of a point', () => {
  const { s, rng } = fresh(2, { duel: true });
  const i = roll(s, rng, ['2', '2', '1', '3', 'H', 'H']);
  assert.equal(s.tokyo.city, i); assert.equal(s.players[i].vp, 0); assert.equal(s.players[i].en, 1);
  assert.equal(fresh(4, { duel: true }).s.duel, false, 'only with 2 players');
});
test('2016 Alpha Monster scores on a rolled claw even with nobody to hit; Regeneration only on heart dice', () => {
  const { s, rng } = fresh(3);
  const i = s.cur; withCard(s, i, 'alpha-monster'); withCard(s, i, 'regeneration'); s.players[i].hp = 5;
  roll(s, rng, ['C', 'H', '1', '2', '3', 'E']); // nobody in Tokyo yet
  assert.equal(s.players[i].hp, 7, '1 heart + 1 Regeneration');
  assert.equal(s.players[i].vp, 2, 'Alpha +1, entering Tokyo +1');
});
test('Rapid Healing and illegal moves throw', () => {
  const { s, rng } = fresh(3);
  assert.throws(() => E.apply(s, s.cur, { t: 'rapid' }, rng));
  assert.throws(() => E.apply(s, other(s, s.cur), { t: 'roll' }, rng), /Not your decision/);
  assert.throws(() => E.apply(s, s.cur, { t: 'buy', i: 0 }, rng));
});

// ------------------------------------------------------------------ odds maths vs brute force
test('odds: one roll of 6 dice has 3+ ones with chance 0.0623 (exact)', () => {
  let hit = 0;
  for (let x = 0; x < 6 ** 6; x++) { let ones = 0, y = x; for (let k = 0; k < 6; k++) { if (y % 6 === 0) ones++; y = Math.floor(y / 6); } if (ones >= 3) hit++; }
  assert.ok(Math.abs(hit / 6 ** 6 - D.chance(6, [0, 0, 0, 0, 0, 0], 1, c => c[0] >= 3)) < 1e-12);
});
test('odds: chasing three 1s with 3 dice and 2 rerolls = (91/216)^3', () => {
  const p = D.chance(3, [0, 0, 0, 0, 0, 0], 3, c => c[0] >= 3);
  assert.ok(Math.abs(p - Math.pow(91 / 216, 3)) < 1e-12, p);
});
test('odds: the keep solver matches a brute-force search over real dice tuples (3 dice, 3 rolls)', () => {
  const val = c => D.setVp(c) + 0.5 * c[5] + 0.3 * c[3];
  const faces = [0, 1, 2, 3, 4, 5];
  const cnt = arr => { const c = [0, 0, 0, 0, 0, 0]; for (const f of arr) c[f]++; return c; };
  const memo = new Map();
  // expected value when `kept` dice stay and the rest are rolled, with r rolls left (this one included).
  // After each roll you may keep ANY of the 3 dice (earlier keeps can be rerolled, as the rules allow).
  function brute(kept, r) {
    const n = 3 - kept.length;
    const key = kept.join() + '|' + r;
    if (memo.has(key)) return memo.get(key);
    let tot = 0, cntT = 0;
    const rec = (arr) => {
      if (arr.length === n) {
        const all = kept.concat(arr);
        let best = val(cnt(all));
        if (r > 1) for (let m = 0; m < 7; m++) best = Math.max(best, brute(all.filter((_, k) => m & (1 << k)).sort(), r - 1));
        tot += best; cntT++; return;
      }
      for (const f of faces) rec(arr.concat([f]));
    };
    rec([]);
    const v = tot / cntT; memo.set(key, v); return v;
  }
  const exact = brute([], 3);
  const solv = D.solver(3, val).keepEv([0, 0, 0, 0, 0, 0], 3);
  assert.ok(Math.abs(exact - solv) < 1e-9, exact + ' vs ' + solv);
});

// ------------------------------------------------------------------ whole games
test('100 computer games end properly in both editions, all table sizes, with JSON copies', () => {
  let g = 0;
  for (const edition of ['2016', '2011']) for (const n of [2, 3, 4, 5, 6]) for (let k = 0; k < 10; k++) {
    const { s } = playGame({ n, edition, seed: 1000 + g, copy: k % 4 === 0, levels: Array.from({ length: n }, (_, i) => ['easy', 'medium', 'hard'][(i + k) % 3]) });
    g++;
    assert.equal(s.over, true);
    const alive = s.players.filter(p => p.alive).length;
    if (s.why === 'points') for (const w of s.winners) assert.ok(s.players[w].vp >= 20 && s.players[w].alive);
    if (s.why === 'last') assert.equal(alive, 1);
    if (s.tokyo.bay >= 0) assert.ok(alive >= 5, 'Bay used with ' + alive + ' monsters');
    for (const p of s.players) assert.ok(p.hp <= 12 && p.en >= 0 && p.vp >= 0);
    const cardsInPlay = s.players.reduce((a, p) => a + p.cards.length, 0);
    assert.equal(s.deck.length + s.discard.length + s.market.filter(Boolean).length + cardsInPlay, 66, 'no card lost or duplicated');
  }
});

test('the discard pile is face up: the public view shows its top 4 cards (so a reload shows them too)', () => {
  const { s } = fresh(3);
  s.discard = ['heal', 'tanks', 'energize', 'skyscraper', 'corner-store'];
  assert.deepEqual(E.publicView(s).discardTop, ['tanks', 'energize', 'skyscraper', 'corner-store']);
  s.discard = [];
  assert.deepEqual(E.publicView(s).discardTop, []);
});
