/* King of Tokyo evolutions (the Power Up! expansion idea), an option that is off by default.
   Each monster has its own deck of 8. Names and Permanent/Temporary are game facts; the texts are in
   our own words. Sources and the per-card rulings: docs/rules-check.md ("Evolutions").
   Each row: id, monster index (Cards.MONSTERS), name, P(ermanent)/T(emporary), when it can be played, text.
   when: 'turn'  = on your own turn, at the start, while rolling or while buying
         'start' = on your turn, before you roll
         'dice'  = on your turn, before you roll or while rolling (before the dice resolve)
         'buy'   = on your turn, after the dice resolved
         'tokyo' = on your turn, while you are in Tokyo
         'hit'   = offered when you are about to lose hearts (also playable on your turn if 'turn' too)
         'claim' = offered when Tokyo is about to be taken by the monster whose turn it is
         'end'   = on your turn after the dice, or offered at the end of any turn you lost hearts in
         'ko'    = played for you at once when you drop to 0 hearts */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KotEvo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LIST = [
    // ---------------- The King (0)
    ['monkey-rush', 0, 'Monkey Rush', 'T', 'claim', 'When the monster in Tokyo leaves it or is knocked out, take its place in Tokyo yourself.'],
    ['simian-scamper', 0, 'Simian Scamper', 'T', 'hit', 'When claws hit you in Tokyo: leave Tokyo now and lose no hearts for the rest of this turn.'],
    ['jungle-frenzy', 0, 'Jungle Frenzy', 'T', 'buy', 'On your turn, if you hurt a monster in Tokyo and did not move in yourself, take another turn after this one.'],
    ['giant-banana', 0, 'Giant Banana', 'T', 'turn hit', 'Gain 2 hearts.'],
    ['chest-thumping', 0, 'Chest Thumping', 'P', 'turn', 'You decide whether the monsters your claws hurt in Tokyo must leave it.'],
    ['alpha-male', 0, 'Alpha Male', 'P', 'turn', 'On each of your turns that you make a monster lose hearts, gain 1 ★.'],
    ['i-am-the-king', 0, 'I Am the King!', 'P', 'turn', 'Gain 1 extra ★ when you move into Tokyo and when you start your turn there.'],
    ['twas-beauty', 0, '’Twas Beauty Killed the Beast', 'P', 'tokyo', 'Play while in Tokyo. Gain 1 ★ at the end of every monster’s turn. When you leave Tokyo, discard it and lose all your ★.'],
    // ---------------- Gigazaur (1)
    ['detachable-tail', 1, 'Detachable Tail', 'T', 'hit', 'When you are about to lose hearts: lose none for the rest of this turn.'],
    ['radioactive-waste', 1, 'Radioactive Waste', 'T', 'turn hit', 'Gain 2 ⚡ and 1 heart.'],
    ['primal-bellow', 1, 'Primal Bellow', 'T', 'turn', 'Every other monster loses 2 ★.'],
    ['saurian-adaptability', 1, 'Saurian Adaptability', 'T', 'dice', 'Before your dice resolve: pick a face, and turn every die showing it into one other face of your choice.'],
    ['defender-of-tokyo', 1, 'Defender of Tokyo', 'P', 'turn', 'When you start your turn in Tokyo, every other monster loses 1 ★.'],
    ['heat-vision', 1, 'Heat Vision', 'P', 'turn', 'A monster that makes you lose hearts loses 1 ★.'],
    ['gamma-breath', 1, 'Gamma Breath', 'P', 'turn', 'Once each turn, turn one of your dice into a claw.'],
    ['tail-sweep', 1, 'Tail Sweep', 'P', 'turn', 'Once each turn, turn one of your dice into a 1 or a 2.'],
    // ---------------- Cyber Kitty (2)
    ['nine-lives', 2, 'Nine Lives', 'T', 'ko', 'When you drop to 0 hearts: discard your cards and evolutions in play, lose all ⚡ and ★, leave Tokyo, then gain 9 hearts and 9 ★ and play on.'],
    ['mega-purr', 2, 'Mega Purr', 'T', 'turn', 'Every other monster gives you 1 ⚡ or 1 ★ (its choice), if it has any.'],
    ['electro-scratch', 2, 'Electro-Scratch', 'T', 'turn', 'Every other monster loses 1 heart.'],
    ['cat-nip', 2, 'Cat Nip', 'T', 'start', 'Play before you roll: you roll only once this turn, and every die counts twice.'],
    ['play-with-your-food', 2, 'Play with Your Food', 'P', 'turn', 'When your claws would take 2 or more hearts from a monster in Tokyo, you may take 2 fewer and steal 1 ★ and 1 ⚡ from it instead.'],
    ['feline-motor', 2, 'Feline Motor', 'P', 'turn', 'On another monster’s turn, if Tokyo is empty when it would move in and you did not start the turn there, you may move in instead.'],
    ['mouse-hunter', 2, 'Mouse Hunter', 'P', 'turn', 'If your dice show at least one 1, gain 1 ★.'],
    ['meow-missile', 2, 'Meow Missile', 'P', 'turn', 'If your dice show at least one 1, add a claw.'],
    // ---------------- Alienoid (3)
    ['alien-scourge', 3, 'Alien Scourge', 'T', 'turn', 'Gain 2 ★.'],
    ['precision-field-support', 3, 'Precision Field Support', 'T', 'turn', 'Turn over power cards from the deck until a keep card that costs 4 ⚡ or less: take it for free. The others are discarded.'],
    ['anger-batteries', 3, 'Anger Batteries', 'T', 'end', 'Gain 1 ⚡ for each heart you lost this turn.'],
    ['adapting-technology', 3, 'Adapting Technology', 'P', 'turn', 'Starts with 3 tokens. While buying, spend one to sweep the 3 cards for free. Discard it when empty.'],
    ['funny-looking', 3, 'Funny Looking But Dangerous', 'P', 'turn', 'If your dice show 2-2-2 or more, every other monster loses 1 heart.'],
    ['exotic-arms', 3, 'Exotic Arms', 'P', 'turn', 'Before you roll, you may put 2 ⚡ on it. With 3 or more claws, take them back and the monsters you hurt lose 2 extra hearts; otherwise lose those ⚡ and 2 hearts.'],
    ['mothership-support', 3, 'Mothership Support', 'P', 'turn', 'Once on each of your turns, pay 1 ⚡ to gain 1 heart.'],
    ['superior-alien-technology', 3, 'Superior Alien Technology', 'P', 'turn', 'Buy keep cards for half their cost (rounded up) and mark them. At the start of your turn, roll a die for each marked card: a claw discards it. At most 3 marked cards.'],
    // ---------------- Meka Dragon (4)
    ['mecha-blast', 4, 'Mecha Blast', 'T', 'dice', 'Before your dice resolve: each monster you hurt this turn loses 2 extra hearts.'],
    ['destructive-analysis', 4, 'Destructive Analysis', 'T', 'buy', 'After your dice: gain 1 ⚡ for each claw you rolled this turn.'],
    ['programmed-to-destroy', 4, 'Programmed to Destroy', 'P', 'turn', 'Whenever another monster drops to 0 hearts, gain 3 ★ and 2 ⚡.'],
    ['tune-up', 4, 'Tune-Up', 'T', 'start', 'Play before you roll, outside Tokyo: skip the rest of your turn and gain 4 hearts and 2 ⚡.'],
    ['breath-of-doom', 4, 'Breath of Doom', 'P', 'turn', 'When your claws make monsters in Tokyo lose hearts, every monster outside Tokyo except you loses 1 heart too.'],
    ['lightning-armor', 4, 'Lightning Armor', 'P', 'turn', 'When you lose hearts, roll a die for each: every claw makes the monster whose turn it is lose 1 heart.'],
    ['claws-of-steel', 4, 'Claws of Steel', 'P', 'turn', 'On your turn, a monster you make lose 3 or more hearts at once loses 1 more.'],
    ['target-acquired', 4, 'Target Acquired', 'P', 'turn', 'A monster that hurts you gets your target. The monster with your target loses 1 extra heart whenever you hurt it.'],
    // ---------------- Space Penguin (5)
    ['freeze-ray', 5, 'Freeze Ray', 'P', 'turn', 'When your claws hurt a monster in Tokyo, give it this card. At the start of its turn you name a die face that does nothing that turn; then the card comes back.'],
    ['miraculous-catch', 5, 'Miraculous Catch', 'P', 'turn', 'Once on each of your turns while buying, turn up a random card from the discard pile: buy it for 1 ⚡ less, or put it back.'],
    ['deep-dive', 5, 'Deep Dive', 'T', 'turn', 'Look at the top 3 power cards of the deck: take one for free and put the others under the deck.'],
    ['cold-wave', 5, 'Cold Wave', 'T', 'turn', 'Until your next turn, every other monster rolls 1 less die.'],
    ['encased-in-ice', 5, 'Encased in Ice', 'P', 'turn', 'After your rolls, pay 1 ⚡ to freeze one of your dice: nothing can change it this turn.'],
    ['blizzard', 5, 'Blizzard', 'T', 'turn', 'Until your next turn, the other monsters roll only once and can’t leave Tokyo.'],
    ['black-diamond', 5, 'Black Diamond', 'P', 'turn', 'Gain 1 extra ★ when you move into Tokyo, and when you stay in Tokyo when you could have left.'],
    ['icy-reflection', 5, 'Icy Reflection', 'P', 'turn', 'Copy a permanent evolution in play (not another Icy Reflection) as if you had played it. If that card leaves play, discard this one.'],
  ];
  const EVO = {};
  const BY_MON = [[], [], [], [], [], []];
  for (const [id, mon, name, type, when, text] of LIST) {
    EVO[id] = { id, mon, name, perm: type === 'P', when: when.split(' '), text };
    BY_MON[mon].push(id);
  }
  const deckOf = mon => (BY_MON[mon] || []).slice();
  return { EVO, LIST, BY_MON, deckOf };
});
