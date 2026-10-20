/* The King of Tokyo engine as the shared online module's `game` object (see _online/README.md).
   Used for local play (createLocal) and online rooms (createOnline) alike. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./bots.js'));
  else root.KotGame = factory(root.KotEngine, root.KotBots);
})(typeof self !== 'undefined' ? self : this, function (E, Bots) {
  'use strict';
  const game = {
    id: 'king-of-tokyo',
    minSeats: 2,
    maxSeats: 6,
    // options: { edition: '2016'|'2011', level, levels: [...], bay: bool, monsters: [...] }
    setup(nSeats, options, rng, seats) { return E.setup(nSeats, options, rng, seats); },
    toAct(state) { return E.toAct(state); },
    apply(state, seat, action, rng) { return E.apply(state, seat, action, rng); },
    publicView(state) { return E.publicView(state); },
    privateView(state, seat) { return E.privateView(state, seat); },
    bot(ctx, seat, rng) {
      const s = ctx.state;
      const p = s.players[seat];
      const lvl = p.kind === 'computer' ? p.lvl : s.level;
      return Bots.decide(s, seat, lvl, rng, E.privateView(s, seat));
    },
    isOver(state) { return !!state.over; },
  };
  return { game };
});
