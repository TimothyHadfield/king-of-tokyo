/* kotprofile.js: King of Tokyo's part of the player profile (shared kit js/profile.js, never edit that one here):
 * the computer levels' ratings, the achievements, the Daily game and turning a game into a result.
 *
 * One result per game: a game vs computers, pass-and-play or online. Quitting after your first move counts as a
 * loss. A game where you used Undo counts as "with help" and isn't rated. The guided first game isn't counted.
 * Plain script: window.KotProfile in the browser, module.exports in node (tests/profile.test.js). */
(function (root) {
  'use strict';
  // Elo of each level from 4-player games, one level against three Mediums (tools/measure-levels.js, 2026-10-27).
  // A seat's win share s against a fair share of 1/4 is read as a head-to-head score p = s / (s + (1 - s) / 3);
  // difference = 400·log10(p / (1 − p)), rounded to 10. Easy anchored at 1200.
  //   Easy 4.3% vs 3 Medium -> p 0.12 -> Medium is +350.   Hard 46.4% vs 3 Medium -> p 0.72 -> +170.
  const LEVELS = [{ id: 'easy', name: 'Easy', rating: 1200 }, { id: 'medium', name: 'Medium', rating: 1550 }, { id: 'hard', name: 'Hard', rating: 1720 }];
  const RANK = { easy: 0, medium: 1, hard: 2 };

  const won = c => !!(c.last && c.last.won);
  const ex = c => (c.last && c.last.extra) || {};
  const ACH = [
    { id: 'first', title: 'First win', desc: 'Win a game of King of Tokyo', test: c => c.stats.wins >= 1 },
    { id: 'medium', title: 'Contender', desc: 'Win against Medium computers', test: c => won(c) && RANK[c.last.level] >= 1 },
    { id: 'hard', title: 'King of the city', desc: 'Win against Hard computers', test: c => won(c) && c.last.level === 'hard' },
    { id: 'stars', title: 'Star power', desc: 'Win by reaching 20 ★', test: c => won(c) && ex(c).why === 'points' },
    { id: 'last', title: 'Last one standing', desc: 'Win by knocking out every rival', test: c => won(c) && ex(c).why === 'last' },
    { id: 'tokyo', title: 'Tokyo resident', desc: 'Start 5 turns in Tokyo in one game', test: c => ex(c).tokyoTurns >= 5 },
    { id: 'cards', title: 'Collector', desc: 'Own 5 cards at the end of a game', test: c => !ex(c).quit && ex(c).cards >= 5 },
    { id: 'crowd', title: 'Monster mash', desc: 'Win a game with 6 monsters', test: c => won(c) && ex(c).players >= 6 },
    { id: 'streak', title: 'Rampage', desc: 'Win 3 in a row', test: c => c.stats.bestStreak >= 3 },
    { id: 'daily', title: 'Daily smasher', desc: '3-day Daily streak', test: c => c.daily.streak >= 3 },
  ];

  // Today's Daily game: the same deal and dice for everyone that day. Standard 2016 rules, you + 3 Medium.
  const DAILY = { level: 'medium', computers: 3, edition: '2016' };

  function init(onDaily) {
    if (!root.Profile) return false;
    root.Profile.init({
      game: 'king-of-tokyo', levels: LEVELS, achievements: ACH, draws: true,
      modes: { computer: { name: 'vs computer' }, help: { name: 'With help' }, friends: { name: 'Pass and play' }, online: { name: 'Online' } },
      daily: { title: 'Daily game', onPlay: () => onDaily && onDaily() },
    });
    return true;
  }

  /** The level a game vs computers is rated at: the strongest computer at the table. */
  function tableLevel(levels) {
    let best = null;
    (levels || []).forEach(l => { if (RANK[l] != null && (best == null || RANK[l] > RANK[best])) best = l; });
    return best;
  }

  /** A finished (or abandoned) game -> Profile.recordResult input.
   *  g: { st: engine state or public view, me, helped, daily, online, tokyoTurns } */
  function result(g) {
    const st = g.st, me = g.me, P = st.players || [];
    const over = !!st.over;
    const win = over ? (st.winners || []) : [];
    let w = false, draw = false;
    if (win.indexOf(me) >= 0) { if (win.length > 1) draw = true; else w = true; }
    const humans = P.filter(p => p.kind === 'human').length;
    const mode = g.online ? 'online' : humans > 1 ? 'friends' : g.helped ? 'help' : 'computer';
    const level = mode === 'computer' ? tableLevel(P.filter(p => p.kind === 'computer').map(p => p.lvl || st.level)) : null;
    const p = P[me] || {};
    const extra = { why: over ? st.why || null : null, players: P.length, vp: p.vp || 0, cards: (p.cards || []).length, tokyoTurns: g.tokyoTurns || 0, turns: st.turnNo || 0 };
    if (!over) extra.quit = true;
    // pass and play: nobody at this screen "won" or "lost" (the game is counted as played)
    return { mode, level, won: mode === 'friends' ? null : w, draw: mode === 'friends' ? false : draw, score: p.vp || 0, daily: !!g.daily && mode !== 'online', extra };
  }

  const api = { LEVELS, ACH, DAILY, RANK, init, tableLevel, result };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KotProfile = api;
})(typeof window !== 'undefined' ? window : globalThis);
