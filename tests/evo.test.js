// Evolutions (the Power Up! idea, an option that is off by default): one test per card, plus the basics.
// Rulings and sources: docs/rules-check.md ("Evolutions").   Run: node --test tests/evo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const Evo = require('../js/evolutions.js');
const { mulberry, playGame } = require('../tools/sim.js');

const humans = n => Array.from({ length: n }, (_, i) => ({ kind: 'human', name: 'P' + i }));
// a game with evolutions on; player i plays monster i; seat 0 starts
function evoGame(n, seed) {
  const rng = mulberry(seed || 1);
  const s = E.setup(n || 3, { edition: '2016', evo: true, monsters: [0, 1, 2, 3, 4, 5].slice(0, n || 3) }, rng, humans(n || 3));
  return { s, rng };
}
const give = (s, i, id) => { s.players[i].eh.push(id); };
const put = (s, i, id) => { const c = { id, k: s.nextK++ }; s.players[i].evo.push(c); return c; };
const play = (s, rng, id, extra) => E.apply(s, s.cur, Object.assign({ t: 'evo', id }, extra || {}), rng);
const F = str => str.split('').map(f => ({ f, k: false }));
// the active player rolls exactly these faces (a string like 'CC123E') and stops
function roll(s, rng, faces, doneRng) {
  assert.equal(s.ask.type, 'start');
  E.apply(s, s.cur, { t: 'roll' }, rng);
  s.t.dice = F(faces);
  E.apply(s, s.cur, { t: 'done' }, doneRng || rng);
}
const nxt = (s, i, d) => (i + (d || 1)) % s.players.length;
const at = s => (s.ask ? s.ask.type : null);
const always = x => () => x;            // a "random" stream that always gives x (0.99 -> a claw, 0 -> a 1)

// ------------------------------------------------------------------ basics
test('evolutions are off by default: no new fields, and the same deck, cards and first player as before', () => {
  const a = E.setup(4, { edition: '2016' }, mulberry(5), humans(4));
  const b = E.setup(4, { edition: '2016', evo: true }, mulberry(5), humans(4));
  assert.equal(a.evo, undefined);
  for (const p of a.players) assert.equal(p.eh, undefined);
  assert.equal(b.evo, true);
  assert.deepEqual(b.market, a.market);
  assert.deepEqual(b.deck, a.deck);
  assert.equal(b.first, a.first);
});
test('setup: each monster gets its own deck of 8 evolutions, hand empty', () => {
  const { s } = evoGame(6);
  for (const p of s.players) {
    assert.deepEqual(p.ed.slice().sort(), Evo.BY_MON[p.mon].slice().sort());
    assert.deepEqual(p.eh, []);
    assert.deepEqual(p.evo, []);
  }
  assert.equal(Evo.LIST.length, 48);
});
test('ending your rolls with 3 hearts draws one evolution (even in Tokyo); 2 hearts draws none', () => {
  let { s, rng } = evoGame(3); const i = s.cur;
  roll(s, rng, 'HHH123');
  assert.equal(s.players[i].eh.length, 1);
  assert.equal(s.players[i].ed.length, 7);
  ({ s, rng } = evoGame(3)); s.tokyo.city = s.cur;
  roll(s, rng, 'HHHHE1');
  assert.equal(s.players[s.cur].eh.length, 1);
  ({ s, rng } = evoGame(3));
  roll(s, rng, 'HH1123');
  assert.equal(s.players[s.cur].eh.length, 0);
});
test('your hand is secret: others see how many, you see which', () => {
  const { s } = evoGame(3);
  give(s, 1, 'tail-sweep'); give(s, 1, 'heat-vision');
  const pub = E.publicView(s);
  assert.equal(pub.players[1].hand, 2);
  assert.equal(pub.players[1].eh, undefined);
  assert.equal(pub.evo, true);
  assert.deepEqual(E.privateView(s, 1).hand, ['tail-sweep', 'heat-vision']);
  assert.equal(E.privateView(s, 2).hand.length, 0);
  assert.ok(!JSON.stringify(pub).includes('tail-sweep'));
});
test('playing: only cards in your hand; a Temporary is discarded, a Permanent stays in play; the same step goes on', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  assert.throws(() => play(s, rng, 'alien-scourge'), /hand/);
  give(s, i, 'alien-scourge'); give(s, i, 'alpha-male');
  play(s, rng, 'alien-scourge');
  assert.deepEqual(s.players[i].ex, ['alien-scourge']);
  play(s, rng, 'alpha-male');
  assert.equal(s.players[i].evo[0].id, 'alpha-male');
  assert.equal(at(s), 'start');
  assert.equal(E.publicView(s).players[i].evo[0].id, 'alpha-male');
});
test('computers play whole games with evolutions on at every level, and use them', () => {
  let played = 0, drawn = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const lv = ['easy', 'medium', 'hard'];
    const { s } = playGame({ n: 2 + (seed % 5), seed, evo: true, copy: seed % 3 === 0, levels: Array.from({ length: 6 }, (_, k) => lv[(k + seed) % 3]) });
    assert.ok(s.over);
    played += s.players.reduce((a, p) => a + p.ex.length + p.evo.length, 0);
    drawn += s.players.reduce((a, p) => a + 8 - p.ed.length, 0);
  }
  assert.ok(drawn > 30 && played >= 0.75 * drawn, 'evolutions drawn ' + drawn + ', played ' + played);
});

// ------------------------------------------------------------------ The King
test('Monkey Rush: when the monster in Tokyo leaves, you take its place instead of the attacker', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i), k = nxt(s, i, 2);
  give(s, j, 'monkey-rush'); s.tokyo.city = k;
  roll(s, rng, 'CCC123');
  E.apply(s, k, { t: 'yield', leave: true }, rng);
  assert.equal(at(s), 'claim');
  E.apply(s, j, { t: 'claim', use: true }, rng);
  assert.equal(s.tokyo.city, j);
  assert.ok(s.players[j].ex.includes('monkey-rush'));
  assert.equal(at(s), 'buy');
});
test('Simian Scamper: hit in Tokyo, leave at once and lose no hearts', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, j, 'simian-scamper'); s.tokyo.city = j;
  roll(s, rng, 'CCC123');
  assert.equal(at(s), 'guard');
  E.apply(s, j, { t: 'guard', id: 'simian-scamper' }, rng);
  assert.equal(s.players[j].hp, 10);
  assert.equal(s.tokyo.city, i, 'the attacker takes the empty spot');
});
test('Jungle Frenzy: hurt the monster in Tokyo without moving in, and take another turn', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, i, 'jungle-frenzy'); s.tokyo.city = j;
  roll(s, rng, 'C12312');
  E.apply(s, j, { t: 'yield', leave: false }, rng);
  play(s, rng, 'jungle-frenzy');
  E.apply(s, i, { t: 'end' }, rng);
  assert.equal(s.cur, i);
  const b = evoGame(3); give(b.s, b.s.cur, 'jungle-frenzy'); b.s.tokyo.city = nxt(b.s, b.s.cur);
  roll(b.s, b.rng, '112233');
  assert.throws(() => play(b.s, b.rng, 'jungle-frenzy'), /Tokyo/);
});
test('Giant Banana: +2 hearts on your turn, or when you are about to lose hearts', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  s.players[i].hp = 5; give(s, i, 'giant-banana');
  play(s, rng, 'giant-banana');
  assert.equal(s.players[i].hp, 7);
  give(s, j, 'giant-banana'); s.tokyo.city = j; s.players[j].hp = 6;
  roll(s, rng, 'CCC123');
  E.apply(s, j, { t: 'guard', id: 'giant-banana' }, rng);
  assert.equal(s.players[j].hp, 5);
});
test('Chest Thumping: you can force a monster you hurt to leave Tokyo', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, i, 'chest-thumping'); s.tokyo.city = j;
  roll(s, rng, 'C12312');
  E.apply(s, j, { t: 'yield', leave: false }, rng);
  assert.equal(at(s), 'thump');
  E.apply(s, i, { t: 'thump', out: [j] }, rng);
  assert.equal(s.tokyo.city, i);
});
test('Alpha Male: +1 ★ on a turn you make a monster lose hearts', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, i, 'alpha-male'); s.tokyo.city = j;
  roll(s, rng, 'CC1231');
  E.apply(s, j, { t: 'yield', leave: false }, rng);
  assert.equal(s.players[i].vp, 1);
});
test('I Am the King!: +1 extra ★ for moving into Tokyo', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  put(s, i, 'i-am-the-king');
  roll(s, rng, '123EE1');
  assert.equal(s.tokyo.city, i);
  assert.equal(s.players[i].vp, 2);
});
test('’Twas Beauty: only in Tokyo; +1 ★ at the end of every turn; leaving Tokyo costs all your ★', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, i, 'twas-beauty');
  assert.throws(() => play(s, rng, 'twas-beauty'), /Tokyo/);
  s.tokyo.city = i; s.players[i].vp = 4;
  play(s, rng, 'twas-beauty');
  roll(s, rng, '112233');
  E.apply(s, i, { t: 'end' }, rng);
  assert.equal(s.players[i].vp, 5);
  roll(s, rng, 'C11223');
  E.apply(s, i, { t: 'yield', leave: true }, rng);
  assert.equal(s.players[i].vp, 0);
  assert.ok(s.players[i].ex.includes('twas-beauty'));
  assert.equal(s.tokyo.city, j);
});

// ------------------------------------------------------------------ Gigazaur
test('Detachable Tail: about to lose hearts, lose none this turn', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, j, 'detachable-tail'); s.tokyo.city = j;
  roll(s, rng, 'CCC123');
  E.apply(s, j, { t: 'guard', id: 'detachable-tail' }, rng);
  assert.equal(s.players[j].hp, 10);
  assert.equal(at(s), 'buy', 'no hearts lost, so no stay-or-leave choice');
});
test('Radioactive Waste: +2 ⚡ and +1 heart', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  s.players[i].hp = 5; give(s, i, 'radioactive-waste');
  play(s, rng, 'radioactive-waste');
  assert.equal(s.players[i].hp, 6); assert.equal(s.players[i].en, 2);
});
test('Primal Bellow: every other monster loses 2 ★', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  for (const p of s.players) p.vp = 5;
  give(s, i, 'primal-bellow'); play(s, rng, 'primal-bellow');
  assert.deepEqual(s.players.map((p, k) => (k === i ? 'me' : p.vp)).filter(x => x !== 'me'), [3, 3]);
});
test('Saurian Adaptability: every die of one face becomes another face', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, i, 'saurian-adaptability'); s.tokyo.city = j;
  E.apply(s, i, { t: 'roll' }, rng);
  s.t.dice = F('1112E3');
  play(s, rng, 'saurian-adaptability', { from: '1', to: 'C' });
  assert.equal(s.t.dice.map(d => d.f).join(''), 'CCC2E3');
  assert.equal(at(s), 'roll');
});
test('Defender of Tokyo: starting your turn in Tokyo, every other monster loses 1 ★', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, j, 'defender-of-tokyo'); s.tokyo.city = j;
  for (const p of s.players) p.vp = 3;
  roll(s, rng, '112233');
  E.apply(s, i, { t: 'end' }, rng);
  assert.equal(s.cur, j);
  assert.equal(s.players[i].vp, 2);
  assert.equal(s.players[j].vp, 5);
});
test('Heat Vision: a monster that makes you lose hearts loses 1 ★', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, j, 'heat-vision'); s.tokyo.city = j; s.players[i].vp = 3;
  roll(s, rng, 'C11223');
  assert.equal(s.players[i].vp, 2, '-1 Heat Vision');
});
test('Gamma Breath: once a turn, one die becomes a claw', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  put(s, i, 'gamma-breath');
  E.apply(s, i, { t: 'roll' }, rng); s.t.dice = F('111111');
  E.apply(s, i, { t: 'change', via: 'gamma', i: 0, f: 'C' }, rng);
  assert.equal(s.t.dice[0].f, 'C');
  assert.throws(() => E.apply(s, i, { t: 'change', via: 'gamma', i: 1, f: 'C' }, rng), /used/);
});
test('Tail Sweep: once a turn, one die becomes a 1 or a 2', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  put(s, i, 'tail-sweep');
  E.apply(s, i, { t: 'roll' }, rng); s.t.dice = F('CCCCCC');
  assert.throws(() => E.apply(s, i, { t: 'change', via: 'sweep', i: 0, f: '3' }, rng), /1 or a 2/);
  E.apply(s, i, { t: 'change', via: 'sweep', i: 0, f: '2' }, rng);
  assert.equal(s.t.dice[0].f, '2');
  assert.throws(() => E.apply(s, i, { t: 'change', via: 'sweep', i: 1, f: '1' }, rng), /used/);
});

// ------------------------------------------------------------------ Cyber Kitty
test('Nine Lives: knocked out, you come back with 9 hearts and 9 ★ (cards, ⚡ and Tokyo gone)', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, j, 'nine-lives'); put(s, j, 'mouse-hunter'); s.players[j].cards.push({ id: 'acid-attack', k: s.nextK++ });
  s.tokyo.city = j; s.players[j].hp = 2; s.players[j].en = 5; s.players[j].vp = 15;
  roll(s, rng, 'CCC123');
  const p = s.players[j];
  assert.ok(p.alive);
  assert.deepEqual([p.hp, p.vp, p.en, p.cards.length, p.evo.length, s.tokyo.city === j], [9, 9, 0, 0, 0, false]);
});
test('Mega Purr: every other monster gives you 1 ⚡ (or 1 ★ if it has no ⚡)', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i), k = nxt(s, i, 2);
  s.players[j].en = 2; s.players[k].vp = 3;
  give(s, i, 'mega-purr'); play(s, rng, 'mega-purr');
  assert.deepEqual([s.players[i].en, s.players[i].vp, s.players[j].en, s.players[k].vp], [1, 1, 1, 2]);
});
test('Electro-Scratch: every other monster loses 1 heart', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  give(s, i, 'electro-scratch'); play(s, rng, 'electro-scratch');
  assert.deepEqual(s.players.map(p => p.hp).sort(), [10, 9, 9].sort());
});
test('Cat Nip: one roll only, and every die counts twice', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  give(s, i, 'cat-nip'); play(s, rng, 'cat-nip');
  E.apply(s, i, { t: 'roll' }, rng);
  assert.equal(s.t.rerolls, 0);
  assert.deepEqual(E.rerollOptions(s), []);
  s.t.dice = F('EEE123');
  E.apply(s, i, { t: 'done' }, rng);
  assert.equal(s.players[i].en, 6);
});
test('Play with Your Food: take 2 fewer hearts and steal 1 ★ and 1 ⚡', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, i, 'play-with-your-food'); s.tokyo.city = j; s.players[j].vp = 3; s.players[j].en = 3;
  roll(s, rng, 'CCC123');
  assert.equal(at(s), 'food');
  E.apply(s, i, { t: 'food', use: true }, rng);
  assert.deepEqual([s.players[j].hp, s.players[j].vp, s.players[j].en, s.players[i].en], [9, 2, 2, 1]);
});
test('Feline Motor: when another monster would move into an empty Tokyo, you may go instead', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, j, 'feline-motor');
  roll(s, rng, '112233');
  assert.equal(at(s), 'claim');
  E.apply(s, j, { t: 'claim', use: true }, rng);
  assert.equal(s.tokyo.city, j);
});
test('Mouse Hunter: a 1 in your dice gives 1 ★', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  put(s, i, 'mouse-hunter'); s.tokyo.city = nxt(s, i);
  roll(s, rng, '1EEEEE');
  assert.equal(s.players[i].vp, 1);
});
test('Meow Missile: a 1 in your dice adds a claw', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, i, 'meow-missile'); s.tokyo.city = j;
  roll(s, rng, '1EEEEE');
  assert.equal(s.players[j].hp, 9);
});

// ------------------------------------------------------------------ Alienoid
test('Alien Scourge: +2 ★', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  give(s, i, 'alien-scourge'); play(s, rng, 'alien-scourge');
  assert.equal(s.players[i].vp, 2);
});
test('Precision Field Support: the first keep card costing 4 or less from the deck, for free', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  s.deck.push('armor-plating', 'heal', 'acid-attack');
  give(s, i, 'precision-field-support'); play(s, rng, 'precision-field-support');
  assert.deepEqual(s.players[i].cards.map(c => c.id), ['armor-plating']);
  assert.ok(s.discard.includes('heal') && s.discard.includes('acid-attack'));
});
test('Anger Batteries: +1 ⚡ for each heart you lost this turn (offered at the end of the turn)', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, j, 'anger-batteries'); s.tokyo.city = j;
  roll(s, rng, 'CC1231');
  E.apply(s, j, { t: 'yield', leave: false }, rng);
  E.apply(s, i, { t: 'end' }, rng);
  assert.equal(at(s), 'evoend');
  E.apply(s, j, { t: 'evoend', use: true }, rng);
  assert.equal(s.players[j].en, 2);
});
test('Adapting Technology: 3 free sweeps, then it is discarded', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  give(s, i, 'adapting-technology'); play(s, rng, 'adapting-technology');
  roll(s, rng, '112233');
  for (let n = 0; n < 3; n++) { const m = s.market.slice(); E.apply(s, i, { t: 'sweep', free: true }, rng); assert.notDeepEqual(s.market, m); }
  assert.equal(s.players[i].en, 0);
  assert.equal(s.players[i].evo.length, 0);
  assert.throws(() => E.apply(s, i, { t: 'sweep', free: true }, rng), /Adapting/);
});
test('Funny Looking But Dangerous: 2-2-2 makes every other monster lose 1 heart', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  put(s, i, 'funny-looking'); s.tokyo.city = nxt(s, i);
  roll(s, rng, '222EEE');
  assert.deepEqual(s.players.filter((p, k) => k !== i).map(p => p.hp), [9, 9]);
});
test('Exotic Arms: 2 ⚡ on it; 3 claws = +2 damage and the ⚡ back, fewer = lose them and 2 hearts', () => {
  let { s, rng } = evoGame(3); let i = s.cur, j = nxt(s, i);
  put(s, i, 'exotic-arms'); s.tokyo.city = j; s.players[i].en = 2;
  E.apply(s, i, { t: 'arms' }, rng);
  assert.equal(s.players[i].en, 0);
  roll(s, rng, 'CCC111');
  assert.equal(s.players[j].hp, 5);
  assert.equal(s.players[i].en, 2);
  ({ s, rng } = evoGame(3)); i = s.cur; j = nxt(s, i);
  put(s, i, 'exotic-arms'); s.tokyo.city = j; s.players[i].en = 2;
  E.apply(s, i, { t: 'arms' }, rng);
  roll(s, rng, 'C11123');
  assert.equal(s.players[i].hp, 8); assert.equal(s.players[i].en, 0); assert.equal(s.players[j].hp, 9);
});
test('Mothership Support: once a turn, 1 ⚡ for 1 heart', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  put(s, i, 'mothership-support'); s.players[i].en = 3; s.players[i].hp = 5;
  E.apply(s, i, { t: 'mother' }, rng);
  assert.deepEqual([s.players[i].hp, s.players[i].en], [6, 2]);
  assert.throws(() => E.apply(s, i, { t: 'mother' }, rng), /once/);
});
test('Superior Alien Technology: keep cards at half cost, marked; a claw at your turn start discards one', () => {
  const { s, rng } = evoGame(2); const i = s.cur, j = nxt(s, i);
  put(s, i, 'superior-alien-technology'); s.players[i].en = 3; s.market[0] = 'acid-attack';
  s.tokyo.city = j;
  roll(s, rng, '112233');
  assert.equal(E.costFor(s, i, 'acid-attack'), 3);
  E.apply(s, i, { t: 'buy', i: 0 }, rng);
  assert.equal(s.players[i].en, 0);
  assert.equal(s.players[i].cards[0].ufo, 1);
  E.apply(s, i, { t: 'end' }, rng);
  roll(s, rng, '112233');
  E.apply(s, j, { t: 'end' }, always(0.99));
  assert.equal(s.cur, i);
  assert.equal(s.players[i].cards.length, 0, 'a claw: the marked card is gone');
});

// ------------------------------------------------------------------ Meka Dragon
test('Mecha Blast: each monster you hurt this turn loses 2 more', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, i, 'mecha-blast'); s.tokyo.city = j;
  play(s, rng, 'mecha-blast');
  roll(s, rng, 'C11123');
  assert.equal(s.players[j].hp, 7);
});
test('Destructive Analysis: +1 ⚡ per claw rolled', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  give(s, i, 'destructive-analysis'); s.tokyo.city = j;
  roll(s, rng, 'CCCEEE');
  E.apply(s, j, { t: 'yield', leave: false }, rng);
  play(s, rng, 'destructive-analysis');
  assert.equal(s.players[i].en, 6);
});
test('Programmed to Destroy: another monster knocked out = +3 ★ and +2 ⚡', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i), k = nxt(s, i, 2);
  put(s, k, 'programmed-to-destroy'); s.tokyo.city = j; s.players[j].hp = 1;
  roll(s, rng, 'C11223');
  assert.ok(!s.players[j].alive);
  assert.deepEqual([s.players[k].vp, s.players[k].en], [3, 2]);
});
test('Tune-Up: outside Tokyo, skip your turn for 4 hearts and 2 ⚡', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  s.players[i].hp = 4; give(s, i, 'tune-up');
  play(s, rng, 'tune-up');
  assert.deepEqual([s.players[i].hp, s.players[i].en], [8, 2]);
  assert.notEqual(s.cur, i);
  const b = evoGame(3); b.s.tokyo.city = b.s.cur; give(b.s, b.s.cur, 'tune-up');
  assert.throws(() => play(b.s, b.rng, 'tune-up'), /Tokyo/);
});
test('Breath of Doom: claws on Tokyo also hit every monster outside Tokyo for 1', () => {
  const { s, rng } = evoGame(4); const i = s.cur, j = nxt(s, i);
  put(s, i, 'breath-of-doom'); s.tokyo.city = j;
  roll(s, rng, 'C11223');
  assert.deepEqual(s.players.map(p => p.hp), s.players.map((p, k) => (k === i ? 10 : 9)));
});
test('Lightning Armor: a die per heart you lose; each claw hurts the attacker', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, j, 'lightning-armor'); s.tokyo.city = j;
  roll(s, rng, 'CC1123', always(0.99));
  assert.equal(s.players[i].hp, 8);
});
test('Claws of Steel: a monster losing 3 or more at once on your turn loses 1 more', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, i, 'claws-of-steel'); s.tokyo.city = j;
  roll(s, rng, 'CCC112');
  assert.equal(s.players[j].hp, 6);
});
test('Target Acquired: whoever hurts you gets the target; you hurt the target for 1 more', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  const c = put(s, j, 'target-acquired'); s.tokyo.city = j;
  roll(s, rng, 'C11223');
  assert.equal(c.tg, i);
  const b = evoGame(3); const bi = b.s.cur, bj = nxt(b.s, bi);
  put(b.s, bi, 'target-acquired').tg = bj; b.s.tokyo.city = bj;
  roll(b.s, b.rng, 'C11223');
  assert.equal(b.s.players[bj].hp, 8);
});

// ------------------------------------------------------------------ Space Penguin
test('Freeze Ray: hurt the monster in Tokyo and it gets the card; you name a face that does nothing on its turn', () => {
  const { s, rng } = evoGame(2); const i = s.cur, j = nxt(s, i);
  const c = put(s, i, 'freeze-ray'); s.tokyo.city = j;
  roll(s, rng, 'C11223');
  E.apply(s, j, { t: 'yield', leave: false }, rng);
  assert.equal(c.on, j);
  E.apply(s, i, { t: 'end' }, rng);
  assert.equal(at(s), 'freeze');
  E.apply(s, i, { t: 'freeze', f: 'E' }, rng);
  roll(s, rng, 'EEEEE1');
  assert.equal(s.players[j].en, 0);
  E.apply(s, j, { t: 'end' }, rng);
  assert.equal(c.on, null);
});
test('Miraculous Catch: once a turn, a random card from the discard pile for 1 ⚡ less', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  put(s, i, 'miraculous-catch'); s.discard = ['heal']; s.players[i].en = 2; s.players[i].hp = 5;
  s.tokyo.city = nxt(s, i);
  roll(s, rng, '112233');
  E.apply(s, i, { t: 'catch' }, rng);
  assert.equal(at(s), 'catch');
  assert.equal(s.ask.id, 'heal');
  E.apply(s, i, { t: 'catch', buy: true }, rng);
  assert.deepEqual([s.players[i].hp, s.players[i].en], [7, 0]);
  assert.throws(() => E.apply(s, i, { t: 'catch' }, rng), /once/);
});
test('Deep Dive: see the top 3, take one free, the others go under the deck', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  s.deck.push('heal', 'energize', 'skyscraper');
  const n = s.deck.length;
  give(s, i, 'deep-dive'); play(s, rng, 'deep-dive');
  assert.equal(at(s), 'dive');
  assert.deepEqual(E.privateView(s, i).dive.slice().sort(), ['energize', 'heal', 'skyscraper']);
  E.apply(s, i, { t: 'dive', id: 'skyscraper' }, rng);
  assert.equal(s.players[i].vp, 4);
  assert.equal(s.deck.length, n - 1);
  assert.deepEqual(s.deck.slice(0, 2).sort(), ['energize', 'heal']);
  assert.equal(at(s), 'start');
});
test('Cold Wave: until your next turn, the others roll 1 less die', () => {
  const { s, rng } = evoGame(2); const i = s.cur;
  give(s, i, 'cold-wave'); play(s, rng, 'cold-wave');
  roll(s, rng, '112233');
  E.apply(s, i, { t: 'end' }, rng);
  E.apply(s, s.cur, { t: 'roll' }, rng);
  assert.equal(s.t.dice.length, 5);
  E.apply(s, s.cur, { t: 'done' }, rng);
  E.apply(s, s.cur, { t: 'end' }, rng);
  assert.equal(s.cur, i);
  assert.deepEqual(s.ling, []);
  assert.ok(s.players[i].ex.includes('cold-wave'));
});
test('Encased in Ice: pay 1 ⚡ to freeze a die so nothing can change it', () => {
  const { s, rng } = evoGame(3); const i = s.cur;
  put(s, i, 'encased-in-ice'); put(s, i, 'gamma-breath'); s.players[i].en = 1;
  E.apply(s, i, { t: 'roll' }, rng); s.t.dice = F('111111');
  E.apply(s, i, { t: 'change', via: 'ice', i: 0 }, rng);
  assert.equal(s.players[i].en, 0);
  assert.throws(() => E.apply(s, i, { t: 'change', via: 'gamma', i: 0, f: 'C' }, rng), /frozen/);
});
test('Blizzard: until your next turn, the others roll only once and can’t leave Tokyo', () => {
  const { s, rng } = evoGame(2); const i = s.cur, j = nxt(s, i);
  give(s, i, 'blizzard'); s.tokyo.city = j;
  play(s, rng, 'blizzard');
  roll(s, rng, 'C11223');
  assert.equal(s.players[j].hp, 9);
  assert.equal(at(s), 'buy', 'no stay-or-leave choice under Blizzard');
  E.apply(s, i, { t: 'end' }, rng);
  E.apply(s, j, { t: 'roll' }, rng);
  assert.equal(s.t.rerolls, 0);
});
test('Black Diamond: +1 extra ★ for moving into Tokyo and for staying when you could leave', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  put(s, i, 'black-diamond');
  roll(s, rng, '123EE1');
  assert.equal(s.players[i].vp, 2);
  const b = evoGame(3); const bi = b.s.cur, bj = nxt(b.s, bi);
  put(b.s, bj, 'black-diamond'); b.s.tokyo.city = bj;
  roll(b.s, b.rng, 'C12312');
  E.apply(b.s, bj, { t: 'yield', leave: false }, b.rng);
  assert.equal(b.s.players[bj].vp, 1);
});
test('Icy Reflection: copy another permanent evolution in play (not another Icy Reflection)', () => {
  const { s, rng } = evoGame(3); const i = s.cur, j = nxt(s, i);
  const a = put(s, j, 'alpha-male'); const ice = put(s, j, 'icy-reflection');
  give(s, i, 'icy-reflection');
  assert.throws(() => play(s, rng, 'icy-reflection', { k: ice.k }), /Icy/);
  play(s, rng, 'icy-reflection', { k: a.k });
  assert.equal(E.hasE(s, i, 'alpha-male'), 1);
});
