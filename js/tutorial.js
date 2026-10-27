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
  // Turn 1 is yours: 3 3 1 ⚡ 2 ♥, and a reroll fills the dice you threw with 3 ⚡ ⚡ ⚡ ...: keep the 3s and
  // the ⚡ and you end on three 3s + three ⚡ (3 stars, 3 energy, then +1 for moving into Tokyo).
  // Turn 2 is the next computer: three claws at you in Tokyo, so you get to choose stay-or-leave.
  // Your second turn: three claws, to show attacking from (or into) Tokyo.
  const SCRIPT = {
    me1: { roll: ['3', '3', '1', 'E', '2', 'H'], reroll: ['3', 'E', 'E', 'E', 'H', '1'] },
    cpu1: { roll: ['C', 'C', 'C', '2', '1', 'H'], reroll: ['2', '1', 'E'], keepClaws: true },
    me2: { roll: ['C', 'C', 'C', 'E', 'H', '1'] },
  };
  function rig(state, seat, action) {
    if (!state || !state.ask || !action || state.over) return null;
    const t = state.t;
    if (!t || t.seat !== seat) return null;
    let part = null;
    if (seat === 0 && state.turnNo === 1) part = SCRIPT.me1;
    else if (seat === 1 && state.turnNo === 2) part = SCRIPT.cpu1;
    else if (seat === 0 && state.turnNo > 1 && state.turnNo <= 6) part = SCRIPT.me2;   // your 2nd turn (turn 4 with 3 monsters)
    if (!part) return null;
    if (state.ask.type === 'start' && action.t === 'roll') return part.roll ? part.roll.slice() : null;
    if (state.ask.type === 'roll' && action.t === 'reroll' && part.reroll) {
      const keep = Array.isArray(action.keep) ? action.keep : [];
      const re = t.dice.map((d, k) => k).filter(k => !keep.includes(k));
      // the computer's claws stay claws whatever it rerolls (so the stay-or-leave moment always comes)
      if (part.keepClaws) { let j = 0; return re.map(k => (t.dice[k].f === 'C' ? 'C' : part.reroll[j++ % part.reroll.length])); }
      if (t.rerolls !== 2) return null;   // your 2nd reroll is your own
      return part.reroll.slice(0, re.length);
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
    return [
      { title: 'Your first game', text: 'You against two computer monsters. Get to 20 ★ first, or be the last monster standing. I’ll walk you through your first turn.' },
      { target: '#v-play .myarea .seat', text: 'This is you. ♥ is your health (10 to start), ★ your points, and the green cubes are ⚡ energy.' },
      { target: '#v-play .opps', text: 'Your rivals sit across the table. Tap any monster to see its cards.' },
      { target: '#v-play .bwrap', text: 'Tokyo. The monster inside earns stars but takes everyone’s claws.' },
      { target: '#btn-roll', title: 'Your turn', text: 'Tap Roll.', when: () => ask() === 'start' || ask() === 'roll', until: () => ask() === 'roll' || turn() > 1 },
      { target: '#v-play .dice', text: 'Six dice: 1, 2 and 3 score in sets of three, ⚡ is energy, ♥ heals, and the claw hits. You get two rerolls.', when: () => ask() === 'roll', skipIf: () => turn() > 1 },
      { target: ['#v-play .dice', '#btn-reroll'], title: 'Keep, then reroll', html: 'Tap a die to keep it (it lifts). Keep the two <b>3s</b> and the <b>⚡</b>, then tap <b>Reroll</b>.', when: () => ask() === 'roll', until: () => { const p = pub(); return !p || !p.t || p.t.rerolls < 2 || ask() !== 'roll'; }, skipIf: () => turn() > 1 },
      { target: ['#v-play .dice', '#btn-done'], html: 'Three 3s score <b>3 ★</b>, and each ⚡ is 1 energy. Tap <b>Done</b> to keep them.', when: () => ask() === 'roll', until: () => ask() !== 'roll', skipIf: () => turn() > 1 || ask() !== 'roll' },
      { target: '#v-play .bwrap', text: 'Tokyo was empty, so you moved in: +1 ★. Next turn you’ll earn 2 more for starting in Tokyo.', when: () => ask() === 'buy', skipIf: () => { const p = pub(); return !p || ask() !== 'buy' || !ctx.inTokyo(me()); } },
      { target: '#v-play #market', title: 'Power cards', text: 'Spend ⚡ on any face-up card. The cost is in the corner. Tap a card to read it and buy it.', when: () => ask() === 'buy', skipIf: () => ask() !== 'buy' },
      { target: '#btn-end', text: 'Tap End turn when you’re done shopping.', when: () => ask() === 'buy', until: () => ask() !== 'buy' && myTurnNo() < 0, skipIf: () => ask() !== 'buy' },
      { text: 'Now the computers play. From outside, their claws can only hit the monster in Tokyo: you.', next: true, skipIf: () => myTurnNo() > 1 || ask() === 'yield' },
      { target: '#v-play .acts', title: 'Stay or leave?', html: 'You were hit. <b>Stay</b> to keep earning stars, or <b>Leave</b> to be safe: the monster that hit you moves in. The % is your chance of being knocked out before your turn.', when: () => ask() === 'yield', until: () => ask() !== 'yield', skipIf: () => myTurnNo() > 1 && ask() !== 'yield' },
      { target: '#v-play .myarea .seat', text: 'Your turn again. Starting it in Tokyo just earned you 2 ★.', when: () => myTurnNo() > 1, skipIf: () => myTurnNo() > 1 && !ctx.inTokyo(me()) },
      { target: '#btn-roll', text: 'Roll again.', when: () => ask() === 'start' || ask() === 'roll', until: () => ask() === 'roll', skipIf: () => ask() !== 'start' },
      { target: '#v-play .dice', text: 'Claws! In Tokyo, your claws hit every monster outside. Outside, they hit whoever is in Tokyo. ♥ dice don’t heal you while you’re in Tokyo.', when: () => ask() === 'roll' || ask() === 'buy', skipIf: () => !ask() },
      { title: 'You’ve got it', text: 'Finish this game your way. The full rules are in Settings → Rules, and the green dot marks the best dice to keep.' },
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
          <p>The 20 ★ win counts at the end of a turn, and only if you are still standing then.</p>` },
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
          <li><b>Leaving:</b> when claws take ♥ from you in Tokyo, you may leave. The monster that hit you moves in and gains 1 ★. You may only leave right after losing ♥ to claws.</li></ul>
          <h4>Tokyo Bay (5 or 6 monsters)</h4>
          <p>A second spot opens. Monsters fill Tokyo City first, then Bay. City and Bay never hit each other. Bay closes once 4 or fewer monsters are left.</p>` },
        { id: 'cards', short: 'Cards', title: 'Power cards', html: `<ul><li>After your dice, buy any of the face-up cards by paying the ⚡ cost in its corner. Each bought card is replaced at once from the deck.</li>
          <li>Pay <b>2 ⚡</b> to sweep: the 3 face-up cards are discarded and 3 new ones dealt. You can sweep more than once.</li>
          <li><b>Keep</b> cards stay in front of you and work for the rest of the game.</li>
          <li><b>Discard</b> cards do their thing at once and go to the discard pile.</li>
          <li>A card's text beats these rules. Read any card in the Cards tab.</li>
          <li>If the deck runs out, this site shuffles the discard pile into a new deck.</li></ul>` },
        { id: 'out', short: 'Knock-out', title: 'Knocked out', html: `<p>A monster at <b>0 ♥</b> is out. Its cards and energy are discarded. If it was in Tokyo, Tokyo is empty again and the next monster to reach that point of its turn moves in.</p>` },
        { id: 'end', short: 'End', title: 'End of the game', html: `<ul><li>At the end of a turn, a monster still standing with 20 ★ or more wins.</li>
          <li>Several monsters at 20 ★ share the win.</li>
          <li>The last monster standing wins. If everyone is knocked out at once, nobody wins.</li></ul>` },
        { id: 'options', short: 'Options', title: 'Options on this site', html: `<ul><li><b>2011 deck</b> (Settings): the first edition's card names and costs. With it, you need a claw to move into an empty Tokyo.</li>
          <li><b>Two-player variant</b> (Settings, 2016 deck): with 2 monsters, Tokyo pays 1 ⚡ instead of ★ for moving in and for starting a turn there.</li>
          <li><b>Tokyo Bay</b> can be switched off for 5–6 monsters.</li></ul>` },
      ],
      foot: 'Fan-made summary in our own words, not the publisher’s rulebook.',
    };
  }

  return { SEED, OPTIONS, KINDS, FACES, SCRIPT, monsters, rig, rigGame, steps, rules };
});
