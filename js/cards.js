/* King of Tokyo power cards, both editions. Names, costs and counts are game facts; the effect
   texts are written in our own words. Each row: id, 2016 name, 2016 cost, Keep/Discard,
   2016 text, copies, then what differs in the 2011 edition. Sources: docs/rules-check.md. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KotCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LIST = [
    // ---------------- Keep cards (48 with 2 Extra Heads)
    ['acid-attack', 'Acid Attack', 6, 'K', 'Add 1 claw to your roll every turn, even when you rolled none.', 1, { t: 'Deal 1 extra damage every turn, even when you don\'t attack.' }],
    ['alien-metabolism', 'Alien Origin', 3, 'K', 'Cards cost you 1 less energy.', 1, { n: 'Alien Metabolism' }],
    ['alpha-monster', 'Alpha Monster', 5, 'K', 'Gain 1 point when you roll at least 1 claw.', 1, { t: 'Gain 1 point when you attack.' }],
    ['armor-plating', 'Armor Plating', 4, 'K', 'When you would lose exactly 1 heart, lose nothing.', 1, {}],
    ['background-dweller', 'Background Dweller', 4, 'K', 'You may always reroll any 3s, as often as you like.', 1, {}],
    ['burrowing', 'Burrowing', 5, 'K', 'Add 1 claw while you are in Tokyo. When you leave Tokyo, the monster taking your place loses 1 heart.', 1, { t: 'Deal 1 extra damage from Tokyo. When you leave Tokyo, deal 1 damage to the monster taking it.' }],
    ['camouflage', 'Camouflage', 3, 'K', 'When you lose hearts, roll a die per heart: each heart rolled cancels one.', 1, {}],
    ['complete-destruction', 'Complete Destruction', 3, 'K', 'If your dice show 1, 2, 3, heart, claw and energy, gain 9 extra points.', 1, {}],
    ['dedicated-news-team', 'Media-Friendly', 3, 'K', 'Gain 1 point whenever you buy a card.', 1, { n: 'Dedicated News Team' }],
    ['eater-of-the-dead', 'Eater of the Dead', 4, 'K', 'Gain 3 points whenever any monster drops to 0 hearts.', 1, {}],
    ['energy-hoarder', 'Energy Hoarder', 3, 'K', 'At the end of your turn, gain 1 point per 6 energy you hold.', 1, {}],
    ['even-bigger', 'Even Bigger', 4, 'K', 'Your maximum is 12 hearts. Gain 2 hearts when you buy it.', 1, { t: 'Your maximum hearts go up by 2. Gain 2 hearts when you get it.' }],
    ['extra-head', 'Extra Head', 7, 'K', 'You roll 1 extra die.', 2, {}],
    ['fire-breathing', 'Fire Breathing', 4, 'K', 'When you roll at least 1 claw, your neighbours lose 1 extra heart, wherever they are.', 1, { t: 'When you deal damage, your neighbours take 1 extra damage.' }],
    ['freeze-time', 'Freeze Time', 5, 'K', 'If you roll at least 1-1-1, take another turn afterwards with one less die.', 1, {}],
    ['friend-of-children', 'Friend of Children', 3, 'K', 'Whenever you gain energy, gain 1 more.', 1, {}],
    ['giant-brain', 'Giant Brain', 5, 'K', 'You get 1 extra reroll each turn.', 1, {}],
    ['gourmet', 'Gourmet', 4, 'K', 'When you roll at least 1-1-1, gain 2 extra points.', 1, {}],
    ['healing-ray', 'Healing Ray', 4, 'K', 'Your hearts can heal other monsters. Each pays you 2 energy per heart (1 if it has only 1).', 1, { t: 'Your hearts can heal other monsters. They pay you 2 energy per heart, or all they have.' }],
    ['herbivore', 'Herbivore', 5, 'K', 'At the end of your turn, gain 1 point if you made nobody lose hearts.', 1, {}],
    ['herd-culler', 'Herd Culler', 3, 'K', 'Once each turn, turn one of your dice into a 1.', 1, {}],
    ['it-has-a-child', 'It Has a Child!', 7, 'K', 'At 0 hearts: discard all your cards, drop to 0 points, leave Tokyo and play on with 10 hearts.', 1, { n: 'It Has a Child', t: 'If you are knocked out: discard all your cards, drop to 0 points and start again with 10 hearts.' }],
    ['jets', 'Jets', 5, 'K', 'If you leave Tokyo after an attack, you lose no hearts from it.', 1, {}],
    ['made-in-a-lab', 'Made in a Lab', 2, 'K', 'When buying, you may look at the top card of the deck and buy it.', 1, {}],
    ['metamorph', 'Metamorph', 3, 'K', 'At the end of your turn, discard any keep cards to get their printed cost back in energy.', 1, {}],
    ['mimic', 'Mimic', 8, 'K', 'Copy one keep card any monster has, as if you bought it. Pay 1 energy at the start of your turn to switch.', 1, {}],
    ['monster-batteries', 'Battery Monster', 3, 'K', 'Put 6 energy from the bank on it. Take 2 at the start of each of your turns; discard it when empty.', 1, { n: 'Monster Batteries', c: 2, t: 'Put any of your energy on it; the bank matches it. Take 2 at the start of each turn; discard it when empty.' }],
    ['nova-breath', 'Nova Breath', 7, 'K', 'Your claws hit every other monster.', 1, {}],
    ['omnivore', 'Detritivore', 4, 'K', 'When you roll at least 1-2-3, gain 2 extra points.', 1, { n: 'Omnivore', t: 'Once each turn, a 1-2-3 scores 2 points. Those dice still count for other sets.' }],
    ['opportunist', 'Opportunist', 3, 'K', 'Whenever a new card is turned face up, you may buy it right away.', 1, {}],
    ['parasitic-tentacles', 'Parasitic Tentacles', 4, 'K', 'On your turn, you may buy keep cards from other monsters, paying them the cost.', 1, {}],
    ['plot-twist', 'Plot Twist', 3, 'K', 'Before resolving, turn one die to any face. Then discard this card.', 1, {}],
    ['poison-quills', 'Poison Quills', 3, 'K', 'When you roll at least 2-2-2, add 2 claws.', 1, { t: 'When you score 2-2-2, also deal 2 damage.' }],
    ['poison-spit', 'Poison Spit', 4, 'K', 'Monsters your claws hurt get a poison token: they lose 1 heart per token at the end of their turns. A heart outside Tokyo removes one.', 1, { t: 'Monsters you damage get a poison token: 1 damage per token at the end of their turns. A heart removes one.' }],
    ['psychic-probe', 'Psychic Probe', 3, 'K', 'After each other monster\'s last roll, you may reroll one of their dice. If it lands on a heart, discard this card.', 1, {}],
    ['rapid-healing', 'Rapid Healing', 3, 'K', 'Any time, pay 2 energy to gain 1 heart, even to stay above 0.', 1, {}],
    ['regeneration', 'Regeneration', 4, 'K', 'When your heart dice heal you, gain 1 more heart.', 1, { t: 'Whenever you heal, heal 1 more.' }],
    ['rooting-for-the-underdog', 'Rooting for the Underdog', 3, 'K', 'At the end of your turn, if you have the fewest points, gain 1 point.', 1, { t: 'At the end of any turn, if you have the fewest points, gain 1 point.' }],
    ['shrink-ray', 'Shrink Ray', 6, 'K', 'Monsters your claws hurt get a shrink token: 1 less die per token. A heart outside Tokyo removes one.', 1, { t: 'Monsters you damage get a shrink token: 1 less die per token. A heart removes one.' }],
    ['smoke-cloud', 'Smoke Cloud', 4, 'K', 'Starts with 3 charges. Spend one for an extra reroll; discard it when empty.', 1, {}],
    ['solar-powered', 'Solar Powered', 2, 'K', 'At the end of your turn, gain 1 energy if you have none.', 1, {}],
    ['spiked-tail', 'Spiked Tail', 5, 'K', 'If you roll at least 1 claw, add 1 more claw.', 1, { t: 'When you attack, deal 1 extra damage.' }],
    ['stretchy', 'Stretchy', 3, 'K', 'Before resolving, pay 2 energy to turn one of your dice to any face.', 1, {}],
    ['telepath', 'Energy Drink', 4, 'K', 'Pay 1 energy for 1 extra reroll.', 1, { n: 'Telepath' }],
    ['urbavore', 'Urbavore', 4, 'K', 'Gain 1 extra point when you start your turn in Tokyo. In Tokyo, if you roll a claw, add 1 more.', 1, { t: 'Gain 1 extra point when you start your turn in Tokyo. Deal 1 extra damage from Tokyo.' }],
    ['were-only-making-it-stronger', 'We\'re Only Making It Stronger!', 3, 'K', 'When you lose 2 or more hearts at once, gain 1 energy.', 1, { n: 'We\'re Only Making It Stronger' }],
    ['wings', 'Wings', 6, 'K', 'Pay 2 energy to lose no hearts for the rest of the turn.', 1, {}],
    // ---------------- Discard cards (18 with 2 Evacuation Orders)
    ['apartment-building', 'Apartment Building', 5, 'D', 'Gain 3 points.', 1, {}],
    ['commuter-train', 'Commuter Train', 4, 'D', 'Gain 2 points.', 1, {}],
    ['corner-store', 'Corner Store', 3, 'D', 'Gain 1 point.', 1, {}],
    ['death-from-above', 'Death From Above', 5, 'D', 'Gain 2 points and take Tokyo City. Every other monster in Tokyo must leave.', 1, { n: 'Drop from High Altitude', t: 'Gain 2 points and take Tokyo City, unless you are already in Tokyo.' }],
    ['energize', 'Energize', 8, 'D', 'Gain 9 energy.', 1, {}],
    ['evacuation-orders', 'Evacuation Orders', 7, 'D', 'Every other monster loses 5 points.', 2, {}],
    ['fire-blast', 'Flame Thrower', 3, 'D', 'Every other monster loses 2 hearts.', 1, { n: 'Fire Blast', t: 'Deal 2 damage to every other monster.' }],
    ['frenzy', 'Frenzy', 7, 'D', 'Your turn ends now and you take another turn.', 1, { t: 'Take another turn after this one.' }],
    ['gas-refinery', 'Gas Refinery', 6, 'D', 'Gain 2 points. Every other monster loses 3 hearts.', 1, {}],
    ['heal', 'Heal', 3, 'D', 'Gain 2 hearts.', 1, {}],
    ['high-altitude-bombing', 'High Altitude Bombing', 4, 'D', 'Every monster, you too, loses 3 hearts.', 1, {}],
    ['jet-fighters', 'Jet Fighters', 5, 'D', 'Gain 5 points and lose 4 hearts.', 1, {}],
    ['national-guard', 'National Guard', 3, 'D', 'Gain 2 points and lose 2 hearts.', 1, {}],
    ['nuclear-power-plant', 'Nuclear Power Plant', 6, 'D', 'Gain 2 points and 3 hearts.', 1, {}],
    ['skyscraper', 'Skyscraper', 6, 'D', 'Gain 4 points.', 1, {}],
    ['tanks', 'Tank', 4, 'D', 'Gain 4 points and lose 3 hearts.', 1, { n: 'Tanks' }],
    ['vast-storm', 'Vast Storm', 6, 'D', 'Gain 2 points. Every other monster loses 1 energy for every 2 it has.', 1, {}],
  ];

  const EDITIONS = { '2016': '2016 edition', '2011': '2011 edition' };
  const BY_ED = { '2016': {}, '2011': {} };
  for (const [id, name, cost, type, text, copies, o11] of LIST) {
    BY_ED['2016'][id] = { id, name, cost, keep: type === 'K', text, copies };
    BY_ED['2011'][id] = { id, name: o11.n || name, cost: o11.c != null ? o11.c : cost, keep: type === 'K', text: o11.t || text, copies };
  }
  // CARDS is the live table; setEdition switches names, costs and texts (the engine also passes the edition)
  const CARDS = {};
  function setEdition(ed) {
    const e = BY_ED[ed] ? ed : '2016';
    for (const k of Object.keys(CARDS)) delete CARDS[k];
    Object.assign(CARDS, BY_ED[e]);
    return e;
  }
  setEdition('2016');
  const card = (ed, id) => (BY_ED[ed] || BY_ED['2016'])[id];

  function deckFor(edition) {
    const deck = [];
    for (const c of Object.values(BY_ED[BY_ED[edition] ? edition : '2016'])) for (let i = 0; i < c.copies; i++) deck.push(c.id);
    return deck;
  }

  // the six monsters of the 2016 box (names are game facts; the drawings are our own)
  const MONSTERS = [
    { id: 'king', name: 'The King', color: '#c8894a' },
    { id: 'gigazaur', name: 'Gigazaur', color: '#6cc46a' },
    { id: 'kitty', name: 'Cyber Kitty', color: '#e57fb7' },
    { id: 'alienoid', name: 'Alienoid', color: '#e3b23c' },
    { id: 'meka', name: 'Meka Dragon', color: '#e2584f' },
    { id: 'penguin', name: 'Space Penguin', color: '#62a9e6' },
  ];

  return { CARDS, LIST, EDITIONS, deckFor, MONSTERS, setEdition, card, BY_ED };
});
