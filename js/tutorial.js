/* King of Tokyo Lab: the guided first game and the rules sheet (uses the shared js/coach.js).
   - SEED + rig(): a stacked first game (you go first, a 3-cost card on sale, scripted dice on the first turns),
     without touching the rules engine: the dice are stacked into the random numbers right before each roll.
   - steps(ctx): the coach's script, driven by the game's own state.
   - rules(): the full base-game rules in our own words. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KotTutorial = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FACES = ['1', '2', '3', 'E', 'H', 'C'];          // engine order (engine.js FACES)
  // found once with COACH.findSeed (tests/tutorial.test.js checks it still holds): with 3 monsters,
  // you play first and a 3-energy card is on sale
  const SEED = 11;
  const OPTIONS = { edition: '2016', level: 'easy', bay: false, duel: false };
  const KINDS = ['human', 'computer', 'computer'];
  // your monster stays the one you picked; the computers get the next two
  function monsters(picked) {
    const me = Number.isInteger(picked) && picked >= 0 && picked < 6 ? picked : 0;
    const out = [me];
    for (let m = 0; out.length < 3; m++) if (!out.includes(m % 6)) out.push(m % 6);
    return out;
  }

  // ---- the stacked dice. Returns the faces the rolled dice get, in order, or null (let the dice fall).
  // A whole first game in four of your turns (3 monsters, so your turns are 1, 4, 7 and 10):
  //  1  you: 3 3 1 ⚡ 2 ♥, and a reroll fills the dice you threw with 3 ⚡ ⚡ ⚡ ...: keep the 3s and the ⚡ and you
  //     end on three 3s + three ⚡ (3 ★, 3 ⚡, +1 ★ for moving into Tokyo); 3 ⚡ buys a 3-cost card.
  //  2  the next computer: three claws at you in Tokyo, so you get to choose stay-or-leave.
  //  4  you (+2 ★ for starting in Tokyo): 3 3 3 3 and two claws (4 ★; the claws hit both rivals).
  //  5  the same computer: claws that leave you on 3 ♥ (never a knock-out), and the coach says leave.
  //  7  you, outside Tokyo: ♥ ♥ 3 3 3 3 (heal 2, 4 ★).
  //  10 you: six 3s (6 ★) = 20 ★, and the win at the end of the turn.
  // Every other computer roll until then is calm (1s, 2s and ♥: no claws, and no energy for damage cards).
  // Stay in Tokyo on turn 5 and you still reach 20 (Tokyo pays 2 ★ a turn); leave on turn 2 and you end on 18.
  const SCRIPT = {
    me1: { roll: ['3', '3', '1', 'E', '2', 'H'], reroll: ['3', 'E', 'E', 'E', 'H', '1'] },
    cpu1: { roll: ['C', 'C', 'C', '2', '1', 'H'], reroll: ['2', '1', 'E'], keepClaws: true },
    me2: { roll: ['3', '3', '3', '3', 'C', 'C'], same: true },
    cpu2: { claws: true },
    me3: { roll: ['H', 'H', '3', '3', '3', '3'], same: true },
    me4: { roll: ['3', '3', '3', '3', '3', '3'], same: true },
    calm: { roll: ['1', '2', 'H', '2', '1', 'H'], reroll: ['1', '2', 'H', '2', '1', 'H'], keepClaws: true },
  };
  const LAST = 12;   // nothing is stacked after the round of your 4th turn
  function part(state, seat) {
    const n = state.turnNo;
    if (n > LAST) return null;
    if (seat === 0) return n === 1 ? SCRIPT.me1 : n <= 6 ? SCRIPT.me2 : n <= 9 ? SCRIPT.me3 : SCRIPT.me4;
    if (seat === 1 && n === 2) return SCRIPT.cpu1;
    if (seat === 1 && n === 5) return SCRIPT.cpu2;
    return SCRIPT.calm;
  }
  // the second hit: enough claws to leave you on 3 ♥ (1 to 4 claws), and only while you are in Tokyo
  function hitRoll(state) {
    const me = state.players[0];
    const inT = state.tokyo && (state.tokyo.city === 0 || state.tokyo.bay === 0);
    const k = inT && me && me.alive ? Math.max(1, Math.min(4, me.hp - 3)) : 0;
    const out = [];
    for (let j = 0; j < 6; j++) out.push(j < k ? 'C' : SCRIPT.calm.roll[j]);
    return out;
  }
  function rig(state, seat, action) {
    if (!state || !state.ask || !action || state.over) return null;
    const t = state.t;
    if (!t || t.seat !== seat) return null;
    const pt = part(state, seat);
    if (!pt) return null;
    if (state.ask.type === 'start' && action.t === 'roll') {
      const r = pt.claws ? hitRoll(state) : pt.roll;
      // the stack only covers the dice thrown, so a card that changes the dice count can't shift it
      return r.slice();
    }
    if (state.ask.type === 'roll' && action.t === 'reroll') {
      const keep = Array.isArray(action.keep) ? action.keep : [];
      const re = t.dice.map((d, k) => k).filter(k => !keep.includes(k));
      // your later scripted turns: a rerolled die lands on the face it is meant to show
      if (pt.same) return re.map(k => pt.roll[k % pt.roll.length]);
      // computers: claws stay claws whatever they reroll (so the stay-or-leave moment always comes); the rest is calm
      if (pt.keepClaws || pt.claws) { let j = 0; const rr = pt.reroll || SCRIPT.calm.reroll; return re.map(k => (t.dice[k].f === 'C' ? 'C' : rr[j++ % rr.length])); }
      if (t.rerolls !== 2) return null;   // your 2nd reroll on turn 1 is your own
      return pt.reroll.slice(0, re.length);
    }
    return null;
  }
  // the engine wrapped so each scripted roll gets its stacked dice (rng = a COACH.rng)
  function rigGame(game, rng) {
    return Object.assign({}, game, {
      apply(state, seat, action, r) {
        let faces = null;
        try { faces = rig(state, seat, action); } catch (e) { faces = null; }
        if (faces && faces.length) rng.stackInts(faces.map(f => FACES.indexOf(f)), 6);
        try { return game.apply(state, seat, action, r); } finally { rng.clear(); }
      },
    });
  }

  // ---- the coach's script. ctx: { pub(), me(), ask(), inTokyo(i) }
  function steps(ctx) {
    const pub = () => ctx.pub(), me = () => ctx.me(), ask = () => ctx.ask();
    const myTurnNo = () => { const p = pub(); return p && p.cur === me() ? p.turnNo : -1; };
    const turn = () => { const p = pub(); return p ? p.turnNo : 0; };
    // which round of the script: 1 = your first turn (and the computers after it), 2 = turns 4-6, 3 = 7-9, 4 = 10-12
    const phase = () => { const n = turn(); return n <= 3 ? 1 : n <= 6 ? 2 : n <= 9 ? 3 : n <= 12 ? 4 : 5; };
    const myP = () => { const p = pub(); return p ? p.players[me()] : null; };
    const over = () => { const p = pub(); return !!(p && p.over); };
    const iWon = () => { const p = pub(); return !!(p && p.over && p.winners.includes(me())); };
    const onSale = id => { const p = pub(); return !!(p && p.market.includes(id)); };
    const at = (ph, ...asks) => phase() === ph && asks.includes(ask());
    return [
      { title: 'Your first game', text: 'You against two computer monsters. Get to 20 ★ first, or be the last monster standing. I’ll walk you through the whole game.' },
      { target: '#v-play .myarea .seat', text: 'This is you. ♥ is your health (10 to start), ★ your points, and the green cubes are ⚡ energy.' },
      { target: '#v-play .opps', text: 'Your rivals sit across the table. Tap any monster to see its cards.' },
      { target: '#v-play .bwrap', text: 'Tokyo. The monster inside earns stars but takes everyone’s claws.' },
      // ---- your first turn: roll and keep, into Tokyo, buy a card
      { target: '#btn-roll', title: 'Your turn', text: 'Tap Roll.', when: () => ask() === 'start' || ask() === 'roll', until: () => ask() === 'roll' || turn() > 1 },
      { target: '#v-play .dice', text: 'Six dice: 1, 2 and 3 score in sets of three, ⚡ is energy, ♥ heals, and the claw hits. You get two rerolls.', when: () => ask() === 'roll', skipIf: () => turn() > 1 },
      { target: ['#v-play .dice', '#btn-reroll'], title: 'Keep, then reroll', html: 'Tap a die to keep it (it lifts). Keep the two <b>3s</b> (the green dots) and the <b>⚡</b> to spend on a card, then tap <b>Reroll</b>.', when: () => ask() === 'roll', until: () => { const p = pub(); return !p || !p.t || p.t.rerolls < 2 || ask() !== 'roll'; }, skipIf: () => turn() > 1 },
      { target: ['#v-play .dice', '#btn-done'], html: 'Three 3s score <b>3 ★</b>, and each ⚡ is 1 energy. Tap <b>Done</b> to keep them.', when: () => ask() === 'roll', until: () => ask() !== 'roll', skipIf: () => turn() > 1 || ask() !== 'roll' },
      { target: '#v-play .bwrap', text: 'Tokyo was empty, so you moved in: +1 ★. Next turn you’ll earn 2 more for starting in Tokyo.', when: () => ask() === 'buy', skipIf: () => { const p = pub(); return !p || ask() !== 'buy' || !ctx.inTokyo(me()); } },
      { target: () => (onSale('poison-quills') ? '#v-play #market [data-id="poison-quills"]' : '#v-play #market'), title: 'Buy a power card', html: 'Cards cost ⚡: the number in the corner. You have 3 ⚡, so tap <b>Poison Quills</b> and <b>Buy</b> it. A KEEP card works for the rest of the game.', when: () => ask() === 'buy', until: () => { const p = myP(); return ask() !== 'buy' || !!(p && p.cards.length); }, skipIf: () => turn() > 1 || (ask() === 'buy' && (!myP() || myP().en < 3 || myP().cards.length > 0)) },
      { target: '#v-play .myarea', text: 'Your new card lies in front of you. Tap it any time to read it again.', when: () => ask() === 'buy', skipIf: () => turn() > 1 || ask() !== 'buy' || !myP() || !myP().cards.length },
      { target: '#btn-end', text: 'Tap End turn when you’re done shopping.', when: () => ask() === 'buy', until: () => ask() !== 'buy' && myTurnNo() < 0, skipIf: () => ask() !== 'buy' },
      // ---- the computers hit back: stay or leave
      { text: 'Now the computers play. From outside, their claws can only hit the monster in Tokyo: you.', next: true, skipIf: () => myTurnNo() > 1 || ask() === 'yield' },
      { target: '#v-play .acts', title: 'Stay or leave?', html: 'You were hit. <b>Stay</b> to keep earning stars, or <b>Leave</b> to be safe: the monster that hit you moves in. The % is your chance of being knocked out before your turn.', when: () => ask() === 'yield', until: () => ask() !== 'yield', skipIf: () => myTurnNo() > 1 && ask() !== 'yield' },
      // ---- your second turn: stars for starting in Tokyo, claws
      { target: '#v-play .myarea .seat', text: 'Your turn again. Starting it in Tokyo just earned you 2 ★.', when: () => myTurnNo() > 1, skipIf: () => phase() > 2 || (myTurnNo() > 1 && !ctx.inTokyo(me())) },
      { target: '#btn-roll', text: 'Roll again.', when: () => at(2, 'start', 'roll'), until: () => ask() === 'roll' || phase() > 2, skipIf: () => phase() > 2 },
      { target: ['#v-play .dice', '#btn-done'], html: 'Four 3s: 3 ★ for the set and 1 for the extra 3. <b>Claws</b> from Tokyo hit every monster outside; from outside, the one in Tokyo. Tap <b>Done</b>.', when: () => at(2, 'roll'), until: () => ask() !== 'roll', skipIf: () => phase() > 2 || at(2, 'buy') },
      { target: '#btn-end', text: 'Your claws took ♥ off your rivals. Tap End turn.', when: () => at(2, 'buy'), until: () => ask() !== 'buy', skipIf: () => phase() > 2 },
      // ---- hit again: leave Tokyo
      { target: '#v-play .acts', title: 'Time to leave', html: 'That hurt, and you’re low on ♥. Tap <b>Leave</b>: the monster that hit you moves in and takes the claws, and outside you can heal.', when: () => ask() === 'yield', until: () => ask() !== 'yield', skipIf: () => phase() > 2 || over() },
      // ---- your third turn: healing outside Tokyo
      { target: '#btn-roll', title: 'Heal up', text: 'Your turn. Roll.', when: () => at(3, 'start', 'roll'), until: () => ask() === 'roll' || phase() > 3, skipIf: () => phase() > 3 || over() },
      { target: ['#v-play .dice', '#btn-done'], html: 'Each <b>♥</b> heals 1, but only outside Tokyo: in Tokyo they do nothing. Four 3s are 4 ★ again. Tap <b>Done</b>.', when: () => at(3, 'roll'), until: () => ask() !== 'roll', skipIf: () => phase() > 3 || at(3, 'buy') || over() },
      { target: '#btn-end', text: 'Tap End turn. The monster in Tokyo takes the hits now.', when: () => at(3, 'buy'), until: () => ask() !== 'buy', skipIf: () => phase() > 3 || over() },
      // ---- your fourth turn: the win
      { target: '#btn-roll', title: 'Go for the win', text: 'Count your ★: six more and you reach 20. Roll.', when: () => at(4, 'start', 'roll'), until: () => ask() === 'roll' || phase() > 4, skipIf: () => phase() > 4 || over() },
      { target: ['#v-play .dice', '#btn-done'], html: 'Six 3s: 3 ★ for the set and 1 for each extra 3, so <b>6 ★</b>. Tap <b>Done</b>.', when: () => at(4, 'roll'), until: () => ask() !== 'roll', skipIf: () => phase() > 4 || at(4, 'buy') || over() },
      { target: '#btn-end', html: '20 ★ wins at the <b>end</b> of your turn, if you are still standing. Tap <b>End turn</b>.', when: () => at(4, 'buy'), until: () => ask() !== 'buy', skipIf: () => phase() > 4 || over() },
      { title: 'You won!', text: 'That was a whole game: dice, Tokyo, a card, healing and the win. Tap New game to play your own. The full rules are in the ⋯ menu → Rules.', when: () => over(), skipIf: () => over() && !iWon() },
      { title: 'You’ve got it', text: 'That was a whole game. The green dot marks the best dice to keep, and the full rules are in the ⋯ menu → Rules.', when: () => over(), skipIf: () => iWon() },
    ];
  }

  // ---- the rules sheet: base game, 2016 rules (the app's default), our own words
  function rules(art) {
    const A = art || null;
    const die = f => A ? `<span class="kdie">${A.face(f, 18, '#5fd36e')}</span>` : f;
    return {
      title: 'How to play King of Tokyo',
      intro: '2 to 6 monsters fight over Tokyo. These are the base-game rules this site plays (2016 edition).',
      sections: [
        { id: 'goal', short: 'Goal', title: 'Goal', html: `<p>Be the first monster with <b>20 ★</b>, or the <b>last monster standing</b>.</p>
          <p>On this site the 20 ★ win counts at the end of a turn, and only if you are still standing then.</p>` },
        { id: 'setup', short: 'Setup', title: 'Setup', html: `<ul><li>Each monster starts with <b>10 ♥</b>, <b>0 ★</b> and <b>0 ⚡</b>.</li>
          <li>Shuffle the power cards and lay <b>3 face up</b> next to the deck.</li>
          <li>Tokyo starts empty. There are six black dice.</li>
          <li>At the table, the monster that rolls the most claws goes first. Here the first monster is picked at random.</li></ul>` },
        { id: 'turn', short: 'Turn', title: 'Your turn', html: `<ol><li><b>Start:</b> if you are in Tokyo, gain 2 ★.</li>
          <li><b>Roll</b> the dice, up to three times.</li>
          <li><b>Resolve</b> the dice you end with.</li>
          <li><b>Move into Tokyo</b> if it is empty.</li>
          <li><b>Buy</b> power cards if you like.</li>
          <li><b>End</b> your turn. Play passes clockwise.</li></ol>` },
        { id: 'dice', short: 'Dice', title: 'Rolling and the dice', html: `<p>Roll all six dice. Keep any of them and reroll the rest; then do that once more. You may reroll a die you kept before, and you can stop early.</p>
          <table><tr><td>${die('1')} ${die('2')} ${die('3')}</td><td>Three of the same number score that many ★. Each extra die of that number adds 1 ★ (four 2s = 3 ★). Fewer than three score nothing.</td></tr>
          <tr><td>${die('E')}</td><td>Take 1 ⚡ energy for each.</td></tr>
          <tr><td>${die('H')}</td><td>Heal 1 ♥ for each, up to 10. <b>Not while you are in Tokyo.</b></td></tr>
          <tr><td>${die('C')}</td><td>Each claw deals 1 damage (see Tokyo).</td></tr></table>
          <p class="tip">On this site the green dot under a die marks the best keep, and the bar shows the points your keep gives up.</p>` },
        { id: 'tokyo', short: 'Tokyo', title: 'Tokyo', html: `<ul><li><b>Outside Tokyo</b>, your claws hit the monster in Tokyo.</li>
          <li><b>In Tokyo</b>, your claws hit every monster outside.</li>
          <li><b>Moving in:</b> when Tokyo is empty at that point of your turn, you must move in and gain <b>1 ★</b>.</li>
          <li><b>Staying:</b> each turn you start in Tokyo gains <b>2 ★</b>.</li>
          <li><b>Leaving:</b> when claws take ♥ from you in Tokyo, you may leave. The monster that hit you moves in and gains 1 ★. You still lose the ♥. You may only leave right after losing ♥ to claws.</li></ul>
          <h4>Tokyo Bay (5 or 6 monsters)</h4>
          <p>A second spot opens. Monsters fill Tokyo City first, then Bay. Claws from outside hit both, and each one hit may leave on its own. City and Bay never hit each other. Bay closes once 4 or fewer monsters are left.</p>` },
        { id: 'cards', short: 'Cards', title: 'Power cards', html: `<ul><li>After your dice, buy any of the face-up cards by paying the ⚡ cost in its corner. Each bought card is replaced at once from the deck.</li>
          <li>Pay <b>2 ⚡</b> to sweep: the 3 face-up cards are discarded and 3 new ones dealt. You can sweep more than once.</li>
          <li><b>Keep</b> cards stay in front of you and work for the rest of the game.</li>
          <li><b>Discard</b> cards do their thing at once and go to the discard pile.</li>
          <li>A card's text beats these rules. Read any card in the Cards tab.</li>
          <li>If the deck runs out, this site shuffles the discard pile into a new deck.</li></ul>` },
        { id: 'out', short: 'Knock-out', title: 'Knocked out', html: `<p>A monster at <b>0 ♥</b> is out. Its cards and energy are discarded. If it was in Tokyo, Tokyo is empty again and the next monster to reach that point of its turn moves in.</p>` },
        { id: 'end', short: 'End', title: 'End of the game', html: `<ul><li>At the end of a turn, a monster still standing with 20 ★ or more wins.</li>
          <li>On this site, several monsters at 20 ★ share the win.</li>
          <li>The last monster standing wins. If everyone is knocked out at once, nobody wins.</li></ul>` },
        { id: 'options', short: 'Options', title: 'Options on this site', html: `<ul><li><b>2011 deck</b> (Settings): the first edition's card names and costs. With it, you need a claw to move into an empty Tokyo.</li>
          <li><b>Two-player variant</b> (Settings, 2016 deck): with 2 monsters, Tokyo pays 1 ⚡ instead of ★ for moving in and for starting a turn there.</li>
          <li><b>Tokyo Bay</b> can be switched off for 5–6 monsters.</li></ul>` },
        { id: 'videos', short: 'Videos', title: 'Learn from videos', html: `<p>Videos open on YouTube in a new tab.</p><ul>
          <li><a href="https://www.youtube.com/watch?v=DjfsX847nb0" target="_blank" rel="noopener">How to play</a> · IELLO, the publisher</li>
          <li><a href="https://www.youtube.com/watch?v=RWYGlPf6IzE" target="_blank" rel="noopener">The rules in 3 minutes</a> · The Rules Girl</li>
          <li><a href="https://www.youtube.com/watch?v=ovb4tLs_iZs" target="_blank" rel="noopener">4 strategy tips</a> · Tozat Xemtuhoken</li>
          <li><a href="https://www.youtube.com/watch?v=02UioqEB0Tc" target="_blank" rel="noopener">The Power Up! expansion (evolutions) with a playthrough</a> · Richard Learns Games</li>
          <li><a href="https://www.youtube.com/watch?v=KN0OjRLNd10" target="_blank" rel="noopener">Power Up! review</a> · The Dice Tower</li></ul>` },
      ],
      foot: 'Fan-made summary in our own words, not the publisher’s rulebook.',
    };
  }

  return { SEED, OPTIONS, KINDS, FACES, SCRIPT, LAST, monsters, rig, rigGame, steps, rules };
});
