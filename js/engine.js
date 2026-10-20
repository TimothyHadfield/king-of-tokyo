/* King of Tokyo rules engine. Pure: apply(state, seat, action, rng) -> state (mutates the copy it gets).
   The state is plain JSON. Turn flow runs through a small queue of steps (s.q); a step that needs
   somebody's decision sets s.ask and stops. toAct = the seats s.ask still waits on.
   Rules as checked in docs/rules-check.md. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'));
  else root.KotEngine = factory(root.KotCards);
})(typeof self !== 'undefined' ? self : this, function (Cards) {
  'use strict';
  // the card table of the game's own edition (names, costs and Keep/Discard)
  const CD = (s, id) => Cards.card(s.edition, id);
  const e16 = s => s.edition !== '2011';
  const FACES = ['1', '2', '3', 'E', 'H', 'C'];
  const WIN_VP = 20, START_HP = 10;
  const LOG_MAX = 80;

  const rint = (rng, n) => Math.floor(rng() * n);
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = rint(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const fail = m => { throw new Error(m); };

  // ------------------------------------------------------------------ queries
  const P = (s, i) => s.players[i];
  const aliveSeats = s => s.players.map((p, i) => (p.alive ? i : -1)).filter(i => i >= 0);
  const inTokyo = (s, i) => s.tokyo.city === i || s.tokyo.bay === i;
  const spotOf = (s, i) => (s.tokyo.city === i ? 'city' : s.tokyo.bay === i ? 'bay' : null);

  function findInst(s, k) {
    for (let i = 0; i < s.players.length; i++) {
      const p = s.players[i];
      if (!p.alive) continue;
      const c = p.cards.find(x => x.k === k);
      if (c) return { seat: i, card: c };
    }
    return null;
  }
  // which card a mimic is copying right now (null if its target left play)
  function mimicId(s, inst) {
    if (inst.t == null) return null;
    const f = findInst(s, inst.t);
    return f && f.card.id !== 'mimic' ? f.card.id : null;
  }
  // instances of a card a player has, including a Mimic copying it
  function insts(s, i, id) {
    const p = P(s, i);
    const r = p.cards.filter(c => c.id === id);
    for (const c of p.cards) if (c.id === 'mimic' && mimicId(s, c) === id) r.push(c);
    return r;
  }
  const has = (s, i, id) => insts(s, i, id).length;
  // 2016: Even Bigger sets the maximum to 12 (copies don't stack); 2011: +2 per copy
  const maxHp = (s, i) => (e16(s) ? (has(s, i, 'even-bigger') ? 12 : START_HP) : START_HP + 2 * has(s, i, 'even-bigger'));
  const costFor = (s, i, id) => Math.max(0, CD(s, id).cost - has(s, i, 'alien-metabolism'));
  function bayOpen(s) { return s.bayRule && aliveSeats(s).length >= 5; }
  function diceCount(s, i, less) { return Math.max(0, 6 + has(s, i, 'extra-head') - P(s, i).shrink - (less || 0)); }
  // neighbours: nearest living monster on each side
  function neighbours(s, i) {
    const n = s.players.length, r = [];
    for (let d = 1; d < n; d++) { const j = (i + d) % n; if (P(s, j).alive) { r.push(j); break; } }
    for (let d = 1; d < n; d++) { const j = (i - d + n) % n; if (P(s, j).alive) { if (!r.includes(j)) r.push(j); break; } }
    return r.filter(j => j !== i);
  }

  // ------------------------------------------------------------------ small effects
  function log(s, seat, m) { s.log.push({ s: seat, m, n: s.turnNo }); if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX); }
  const fx = (s, o) => s.fx.push(o);
  function gainVp(s, i, n, why) {
    if (n <= 0 || !P(s, i).alive) return;
    P(s, i).vp += n; fx(s, { k: 'vp', s: i, n });
    if (why) log(s, i, '+' + n + ' ★ ' + why);
  }
  function loseVp(s, i, n) { const p = P(s, i); const d = Math.min(p.vp, n); p.vp -= d; if (d) fx(s, { k: 'vp', s: i, n: -d }); }
  function gainEn(s, i, n, why) {
    if (n <= 0 || !P(s, i).alive) return;
    n += has(s, i, 'friend-of-children');
    P(s, i).en += n; fx(s, { k: 'en', s: i, n });
    if (why) log(s, i, '+' + n + ' ⚡ ' + why);
  }
  // dice = healing from heart dice (2016 Regeneration only adds to that)
  function heal(s, i, n, why, dice) {
    const p = P(s, i);
    if (n <= 0 || !p.alive) return 0;
    if (dice || !e16(s)) n += has(s, i, 'regeneration');
    const d = Math.min(n, maxHp(s, i) - p.hp);
    if (d > 0) { p.hp += d; fx(s, { k: 'hp', s: i, n: d }); if (why) log(s, i, '+' + d + ' ♥ ' + why); }
    return d;
  }
  function leaveTokyo(s, i) { if (s.tokyo.city === i) s.tokyo.city = -1; if (s.tokyo.bay === i) s.tokyo.bay = -1; }
  function enter(s, i, spot) {
    leaveTokyo(s, i);
    s.tokyo[spot] = i;
    log(s, i, 'enters Tokyo ' + (spot === 'city' ? 'City' : 'Bay'));
    fx(s, { k: 'enter', s: i, spot });
    if (s.duel) gainEn(s, i, 1, 'for entering Tokyo');
    else gainVp(s, i, 1, 'for entering Tokyo');
  }
  // a card leaves a player (2011 Even Bigger takes its 2 hearts back with it; 2016 just caps at 10)
  function lostCard(s, i, id) {
    if (id === 'even-bigger' && !e16(s)) { const p = P(s, i); if (p.alive) p.hp = Math.max(1, p.hp - 2); }
  }
  function discardInst(s, i, inst) {
    const p = P(s, i);
    const at = p.cards.indexOf(inst);
    if (at >= 0) { p.cards.splice(at, 1); lostCard(s, i, inst.id); }
    s.discard.push(inst.id);
  }
  // fresh tokens on a card, as if just bought (Smoke Cloud 3 charges, 2016 Battery Monster 6 energy)
  function charge(s, c, id) {
    if (id === 'smoke-cloud') c.c = 3;
    else if (id === 'monster-batteries' && e16(s)) c.c = 6;
    else delete c.c;
  }
  const newInst = (s, id) => { const c = { id, k: s.nextK++ }; if (id === 'smoke-cloud') c.c = 3; return c; };

  // ------------------------------------------------------------------ setup
  function setup(nSeats, options, rng, seats) {
    const o = options || {};
    const n = Math.max(2, Math.min(6, nSeats | 0));
    const edition = o.edition === '2011' ? '2011' : '2016';
    const players = [];
    const mons = shuffle([0, 1, 2, 3, 4, 5], rng);
    for (let i = 0; i < n; i++) {
      const st = (seats && seats[i]) || { kind: 'computer' };
      const pick = Array.isArray(o.monsters) && Number.isInteger(o.monsters[i]) && o.monsters[i] >= 0 && o.monsters[i] < 6 ? o.monsters[i] : null;
      players.push({
        name: String(st.name || 'Player ' + (i + 1)).slice(0, 20), kind: st.kind === 'computer' ? 'computer' : 'human',
        lvl: Array.isArray(o.levels) && ['easy', 'medium', 'hard'].includes(o.levels[i]) ? o.levels[i] : (['easy', 'medium', 'hard'].includes(o.level) ? o.level : 'medium'),
        mon: pick != null ? pick : mons[i], hp: START_HP, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0, wings: false,
      });
    }
    // distinct monsters
    const used = new Set();
    for (const p of players) { if (used.has(p.mon)) p.mon = [0, 1, 2, 3, 4, 5].find(m => !used.has(m)); used.add(p.mon); }
    for (const p of players) if (p.kind === 'computer' && /^(Computer|Player)\b/.test(p.name)) p.name = Cards.MONSTERS[p.mon].name;
    const deck = shuffle(Cards.deckFor(edition), rng);
    const s = {
      v: 1, edition, n, players, deck, discard: [], market: [deck.pop(), deck.pop(), deck.pop()],
      tokyo: { city: -1, bay: -1 }, bayRule: n >= 5 && o.bay !== false,
      // optional 2016 two-player variant: Tokyo pays energy instead of points
      duel: n === 2 && edition === '2016' && !!o.duel,
      level: ['easy', 'medium', 'hard'].includes(o.level) ? o.level : 'medium',
      first: rint(rng, n), cur: -1, turnNo: 0, t: null, q: [], ask: null, extra: [],
      nextK: 1, log: [], fx: [], over: false, winners: [], hist: [],
    };
    s.q.push({ op: 'turn', seat: s.first, less: 0 });
    run(s, rng);
    return s;
  }

  // ------------------------------------------------------------------ the step runner
  function run(s, rng) {
    let guard = 0;
    while (!s.over && !s.ask && s.q.length) {
      const op = s.q.shift();
      OPS[op.op](s, op, rng);
      tidy(s);
      checkEnd(s);
      if (++guard > 5000) fail('engine loop');
    }
    if (!s.over && !s.ask && !s.q.length) fail('engine stalled');
  }
  const front = (s, ...ops) => s.q.unshift(...ops);
  function ask(s, type, seats, extra) { s.ask = Object.assign({ type, seats: seats.slice(), ans: {} }, extra || {}); }

  function tidy(s) {
    for (let i = 0; i < s.players.length; i++) {
      const p = P(s, i);
      if (p.alive && p.hp > maxHp(s, i)) p.hp = maxHp(s, i);
    }
  }
  // Last monster standing (or nobody) ends the game at once. 20 points only counts at the end of a
  // turn (turnEnd = true): you must survive your turn, and everyone at 20+ then shares the win.
  function checkEnd(s, turnEnd) {
    if (s.over) return;
    const alive = aliveSeats(s);
    const vpWin = turnEnd ? alive.filter(i => P(s, i).vp >= WIN_VP) : [];
    if (vpWin.length || alive.length <= 1) {
      s.over = true;
      s.winners = vpWin.length ? vpWin : alive;
      s.ask = null; s.q = [];
      s.why = vpWin.length ? 'points' : alive.length ? 'last' : 'none';
      log(s, s.winners.length ? s.winners[0] : -1, s.winners.length
        ? s.winners.map(i => P(s, i).name).join(' & ') + (vpWin.length ? (vpWin.length > 1 ? ' reach 20 points and share the win!' : ' reaches 20 points and wins!') : ' is the last monster standing!')
        : 'Every monster fell at once. Nobody wins.');
    }
  }

  // damage: hits = [{s, a}] (a before reductions). Applies reductions, tokens, knock-outs.
  function applyHits(s, hits, src, rng, kind) {
    const dealt = [];
    for (const h of hits) {
      const p = P(s, h.s);
      if (!p.alive || h.a <= 0) continue;
      let a = h.a;
      if (p.wings) a = 0;
      if (a === 1 && has(s, h.s, 'armor-plating')) a = 0;
      const cam = has(s, h.s, 'camouflage');
      if (a > 0 && cam) { let saved = 0; for (let k = 0; k < a; k++) if (rint(rng, 6) === 4) saved++; if (saved) log(s, h.s, 'Camouflage blocks ' + saved); a -= saved; }
      if (a <= 0) continue;
      p.hp -= a;
      fx(s, { k: 'hp', s: h.s, n: -a });
      dealt.push({ s: h.s, a, claw: !!h.claw });
      if (a >= 2 && has(s, h.s, 'were-only-making-it-stronger')) gainEn(s, h.s, 1);
      if (src >= 0 && src !== h.s) {
        if (s.t && s.t.seat === src) s.t.hurt = true;
        // 2016: tokens only for monsters that lost hearts to claws; 2011: any damage you deal
        if (h.claw || !e16(s)) {
          const ps = has(s, src, 'poison-spit'), sr = has(s, src, 'shrink-ray');
          if (ps) p.poison += ps;
          if (sr) p.shrink += sr;
        }
      }
    }
    if (dealt.length) log(s, src, (kind || 'deals') + ' ' + dealt.map(d => d.a + ' to ' + P(s, d.s).name).join(', '));
    knockouts(s);
    return dealt;
  }
  function knockouts(s) {
    const down = s.players.map((p, i) => (p.alive && p.hp <= 0 ? i : -1)).filter(i => i >= 0);
    if (!down.length) return;
    for (const i of down) {
      for (const j of aliveSeats(s)) if (!down.includes(j) || has(s, j, 'it-has-a-child')) {
        const e = has(s, j, 'eater-of-the-dead');
        if (e) gainVp(s, j, 3 * e, 'Eater of the Dead');
      }
    }
    for (const i of down) {
      const p = P(s, i);
      if (has(s, i, 'it-has-a-child') && p.cards.some(c => c.id === 'it-has-a-child')) {
        // keeps its energy and its poison/shrink tokens; leaves Tokyo
        for (const c of p.cards.slice()) discardInst(s, i, c);
        p.vp = 0; p.hp = START_HP;
        leaveTokyo(s, i);
        log(s, i, 'is knocked out, but It Has a Child: back with 10 hearts and 0 points');
        fx(s, { k: 'reborn', s: i });
        continue;
      }
      p.alive = false; p.hp = 0;
      leaveTokyo(s, i);
      for (const c of p.cards.slice()) discardInst(s, i, c);
      p.en = 0;
      s.hist.push({ s: i, turn: s.turnNo });
      log(s, i, 'is knocked out!');
      fx(s, { k: 'ko', s: i });
    }
    // Tokyo Bay closes once 4 or fewer monsters are left
    if (s.bayRule && !bayOpen(s) && s.tokyo.bay >= 0) {
      const b = s.tokyo.bay; s.tokyo.bay = -1;
      if (s.tokyo.city < 0) { s.tokyo.city = b; log(s, b, 'moves from Tokyo Bay to Tokyo City'); }
      else log(s, b, 'leaves Tokyo Bay (it closes at 4 monsters)');
    }
  }

  // seats that may spend 2 energy on Wings against these hits
  function wingsCandidates(s, hits) {
    return hits.filter(h => h.a > 0 && P(s, h.s).alive && !P(s, h.s).wings && has(s, h.s, 'wings') && P(s, h.s).en >= 2)
      .map(h => h.s).filter((x, i, a) => a.indexOf(x) === i);
  }
  function takeWings(s, ans) {
    for (const k of Object.keys(ans)) if (ans[k] && ans[k].use) {
      const p = P(s, +k);
      if (p.en >= 2) { p.en -= 2; p.wings = true; log(s, +k, 'spreads its Wings (no damage this turn)'); }
    }
  }

  // ------------------------------------------------------------------ steps
  const OPS = {
    turn(s, op) {
      // the previous turn has ended: this is when 20 points wins
      checkEnd(s, true);
      if (s.over) return;
      let seat = op.seat;
      if (!P(s, seat).alive) { front(s, { op: 'next', after: seat }); return; }
      s.turnNo++;
      s.cur = seat;
      for (const p of s.players) p.wings = false;
      s.t = { seat, less: op.less || 0, dice: [], rolled: false, rerolls: 0, tele: false, herd: false, omni: false, hurt: false, probed: [], done: false, extraTurn: !!op.extra };
      const p = P(s, seat);
      log(s, seat, op.extra ? 'takes an extra turn' : 'starts a turn');
      if (inTokyo(s, seat)) {
        if (s.duel) gainEn(s, seat, 1, 'for starting in Tokyo');
        else gainVp(s, seat, 2, 'for starting in Tokyo');
        const u = has(s, seat, 'urbavore');
        if (u) gainVp(s, seat, u, 'Urbavore');
      }
      for (const c of insts(s, seat, 'monster-batteries')) {
        const take = Math.min(2, c.c || 0);
        c.c = (c.c || 0) - take;
        const nm = CD(s, 'monster-batteries').name;
        if (take) { p.en += take; fx(s, { k: 'en', s: seat, n: take }); log(s, seat, '+' + take + ' ⚡ from ' + nm); }
        if (!c.c && c.id === 'monster-batteries') discardInst(s, seat, c);
      }
      ask(s, 'start', [seat]);
    },
    // after "done rolling": probes, healing ray, resolve, attack, enter, buy
    probe(s) {
      const t = s.t, n = s.players.length;
      for (let d = 1; d < n; d++) {
        const j = (t.seat + d) % n;
        if (!P(s, j).alive || t.probed.includes(j) || !has(s, j, 'psychic-probe') || !t.dice.length) continue;
        front(s, { op: 'probe' });
        ask(s, 'probe', [j]);
        return;
      }
    },
    ray(s) {
      const t = s.t, i = t.seat;
      const hearts = t.dice.filter(d => d.f === 'H').length;
      if (!hearts || !has(s, i, 'healing-ray')) return;
      const hurt = aliveSeats(s).filter(j => j !== i && P(s, j).hp < maxHp(s, j));
      if (hurt.length) ask(s, 'ray', [i]);
    },
    resolve(s) {
      const t = s.t, i = t.seat, p = P(s, i);
      const c = { 1: 0, 2: 0, 3: 0, E: 0, H: 0, C: 0 };
      for (const d of t.dice) c[d.f]++;
      t.counts = c;
      // points from sets of three
      for (const v of [1, 2, 3]) if (c[v] >= 3) gainVp(s, i, v + c[v] - 3, 'for ' + v + '-' + v + '-' + v + (c[v] > 3 ? ' +' + (c[v] - 3) : ''));
      if (c[1] >= 3) {
        const g = has(s, i, 'gourmet'); if (g) gainVp(s, i, 2 * g, 'Gourmet');
        if (has(s, i, 'freeze-time')) { s.extra.unshift({ seat: i, less: t.less + 1, why: 'freeze' }); log(s, i, 'Freeze Time: another turn with one less die'); }
      }
      const om = has(s, i, 'omnivore');
      if (c[1] && c[2] && c[3] && om) gainVp(s, i, 2 * (e16(s) ? om : 1), CD(s, 'omnivore').name);
      if (c[1] && c[2] && c[3] && c.E && c.H && c.C) { const cd = has(s, i, 'complete-destruction'); if (cd) gainVp(s, i, 9 * cd, 'Complete Destruction'); }
      if (c.E) gainEn(s, i, c.E, 'from the dice');
      // hearts do nothing in Tokyo. Outside: clear poison, then shrink, then heal. Some may have gone to Healing Ray.
      let h = c.H - (t.rayUsed || 0);
      if (!inTokyo(s, i)) {
        while (h > 0 && p.poison > 0) { p.poison--; h--; log(s, i, 'cures a poison token'); }
        while (h > 0 && p.shrink > 0) { p.shrink--; h--; log(s, i, 'removes a shrink token'); }
        if (h > 0) heal(s, i, h, 'from the dice', true);
      }
      const tok = inTokyo(s, i);
      if (e16(s)) {
        // 2016: cards ADD claws to the roll. "If you roll at least 1 claw" counts the added ones too.
        let claws = c.C + has(s, i, 'acid-attack') + (tok ? has(s, i, 'burrowing') : 0) + (c[2] >= 3 ? 2 * has(s, i, 'poison-quills') : 0);
        if (claws > 0) claws += has(s, i, 'spiked-tail') + (tok ? has(s, i, 'urbavore') : 0);
        t.claws = claws;
        if (claws > 0) {
          const al = has(s, i, 'alpha-monster'); if (al) gainVp(s, i, al, 'Alpha Monster');
          front(s, { op: 'attack', a: claws, st: 0 });
        }
      } else {
        // 2011: cards add damage to an attack
        const base = c.C + has(s, i, 'acid-attack') + (c[2] >= 3 ? 2 * has(s, i, 'poison-quills') : 0);
        t.claws = c.C;
        if (base > 0) {
          let a = base + has(s, i, 'spiked-tail');
          if (tok) a += has(s, i, 'urbavore') + has(s, i, 'burrowing');
          front(s, { op: 'attack', a, st: 0 });
        }
      }
    },
    attack(s, op, rng) {
      const t = s.t, i = t.seat;
      if (op.st === 0) {
        const nova = has(s, i, 'nova-breath') > 0;
        const fromTokyo = inTokyo(s, i);
        const targets = aliveSeats(s).filter(j => j !== i && (nova || (fromTokyo ? !inTokyo(s, j) : inTokyo(s, j))));
        const hits = targets.map(j => ({ s: j, a: op.a, claw: true }));
        const fb = has(s, i, 'fire-breathing');
        if (fb && e16(s)) {
          // 2016: neighbours lose 1 extra wherever they are (no token unless claws hit them too)
          for (const nb of neighbours(s, i)) { const h = hits.find(x => x.s === nb); if (h) h.a += fb; else hits.push({ s: nb, a: fb, claw: false }); }
        } else if (fb) {
          // 2011: neighbours you damage take 1 extra
          for (const nb of neighbours(s, i)) { const h = hits.find(x => x.s === nb); if (h) h.a += fb; }
        }
        op.hits = hits;
        op.fromTokyo = fromTokyo;
        if (!hits.length) return;
        if (!e16(s) && targets.length) { const al = has(s, i, 'alpha-monster'); if (al) gainVp(s, i, al, 'Alpha Monster'); }
        log(s, i, targets.length ? 'attacks ' + (fromTokyo ? 'everyone outside Tokyo' : nova ? 'every monster' : 'Tokyo') : 'breathes fire on its neighbours');
        op.st = 1;
        const w = wingsCandidates(s, hits);
        front(s, op);
        if (w.length) ask(s, 'wings', w, { dmg: op.a });
        return;
      }
      if (op.st === 1) {
        if (s.answers) { takeWings(s, s.answers); s.answers = null; }
        // Jets: decide to leave before the damage lands
        op.st = 2;
        front(s, op);
        if (!op.fromTokyo) {
          const jets = op.hits.filter(h => h.claw && inTokyo(s, h.s) && !P(s, h.s).wings && has(s, h.s, 'jets')).map(h => h.s);
          if (jets.length) { op.jets = jets; ask(s, 'yield', jets, { jets: true }); }
        }
        return;
      }
      if (op.st === 2) {
        op.left = [];
        if (s.answers) {
          for (const k of Object.keys(s.answers)) if (s.answers[k].leave) op.left.push(+k);
          s.answers = null;
        }
        const hits = op.hits.filter(h => !op.left.includes(h.s));
        const was = { city: s.tokyo.city, bay: s.tokyo.bay };
        op.was = was;
        for (const j of op.left) { leaveTokyo(s, j); log(s, j, 'leaves Tokyo (Jets: no damage)'); }
        const dealt = applyHits(s, hits, i, rng, 'deals');
        op.st = 3;
        front(s, op);
        if (!op.fromTokyo && P(s, i).alive) {
          // you may yield only after actually losing hearts to the claws (Armor, Camouflage, Wings can stop that)
          const may = dealt.filter(d => d.claw && d.a > 0).map(d => d.s).filter(j => !op.left.includes(j) && P(s, j).alive && inTokyo(s, j));
          if (may.length) ask(s, 'yield', may, { jets: false });
        }
        return;
      }
      if (op.st === 3) {
        if (s.answers) {
          for (const k of Object.keys(s.answers)) if (s.answers[k].leave) op.left.push(+k);
          s.answers = null;
        }
        const was = op.was;
        for (const j of op.left) {
          if (inTokyo(s, j)) { leaveTokyo(s, j); log(s, j, 'leaves Tokyo'); fx(s, { k: 'leave', s: j }); }
        }
        if (!P(s, i).alive || inTokyo(s, i)) return;
        // the attacker takes the spot that was given up (City first)
        const gaveCity = op.left.includes(was.city), gaveBay = op.left.includes(was.bay);
        if (gaveCity && s.tokyo.city < 0) enter(s, i, 'city');
        else if (gaveBay && s.tokyo.bay < 0 && bayOpen(s)) enter(s, i, 'bay');
        // Burrowing: a monster that left deals 1 damage to the one taking its place
        if (inTokyo(s, i)) {
          const from = gaveCity && spotOf(s, i) === 'city' ? was.city : gaveBay && spotOf(s, i) === 'bay' ? was.bay : -1;
          if (from >= 0 && P(s, from).alive) {
            const b = has(s, from, 'burrowing');
            if (b) { log(s, from, 'Burrowing!'); applyHits(s, [{ s: i, a: b }], from, rng, 'deals'); }
          }
        }
      }
    },
    enter(s) {
      const i = s.t.seat;
      if (!P(s, i).alive || inTokyo(s, i)) return;
      // 2016: an empty spot must be filled, claws or not. 2011: only a monster that rolled a claw takes it.
      if (!e16(s) && !(s.t.claws > 0)) return;
      if (s.tokyo.city < 0) enter(s, i, 'city');
      else if (bayOpen(s) && s.tokyo.bay < 0) enter(s, i, 'bay');
    },
    buy(s) {
      // a monster knocked out during its own turn skips the rest of it
      if (!P(s, s.t.seat).alive) { front(s, { op: 'next', after: s.t.seat }); return; }
      // 2016 Frenzy bought on your own turn: the turn ends at once (no end-of-turn effects) and a new one starts
      if (s.t.frenzy) { s.q = s.q.filter(o => o.op === 'opp' || o.op === 'refill'); s.q.push({ op: 'turn', seat: s.t.seat, less: 0, extra: true }); return; }
      ask(s, 'buy', [s.t.seat]);
    },
    // generic damage from a card: wings first, then apply
    dmg(s, op, rng) {
      if (op.st === 0) {
        const w = wingsCandidates(s, op.hits);
        op.st = 1;
        if (w.length) { front(s, op); ask(s, 'wings', w, { dmg: Math.max(...op.hits.map(h => h.a)) }); return; }
      }
      if (s.answers) { takeWings(s, s.answers); s.answers = null; }
      applyHits(s, op.hits, op.src, rng, op.kind);
    },
    // a card was turned face up in market slot op.i: Opportunists (not the active monster) may buy it
    opp(s, op) {
      const id = s.market[op.i];
      if (!id) return;
      op.asked = op.asked || [];
      const n = s.players.length, cur = s.cur;
      for (let d = 1; d < n; d++) {
        const j = (cur + d) % n;
        if (!P(s, j).alive || op.asked.includes(j) || !has(s, j, 'opportunist')) continue;
        if (P(s, j).en < costFor(s, j, id)) continue;
        op.asked.push(j);
        front(s, op);
        ask(s, 'opp', [j], { i: op.i });
        return;
      }
    },
    endTurn(s, op, rng) {
      const i = s.t.seat, p = P(s, i);
      if (op.st === 0) {
        op.st = 1;
        if (p.alive && p.poison > 0) { front(s, op, { op: 'dmg', hits: [{ s: i, a: p.poison }], src: -1, kind: 'poison:', st: 0 }); log(s, i, 'suffers ' + p.poison + ' poison'); return; }
      }
      if (p.alive) {
        const eh = has(s, i, 'energy-hoarder');
        if (eh && p.en >= 6) gainVp(s, i, eh * Math.floor(p.en / 6), 'Energy Hoarder');
        if (has(s, i, 'solar-powered') && p.en === 0) gainEn(s, i, 1, 'Solar Powered');
        const hb = has(s, i, 'herbivore');
        if (hb && !s.t.hurt) gainVp(s, i, hb, 'Herbivore');
      }
      const alive = aliveSeats(s);
      if (alive.length) {
        const low = Math.min(...alive.map(j => P(s, j).vp));
        const lows = alive.filter(j => P(s, j).vp === low);
        // 2016: only at the end of its owner's own turn; 2011: at the end of any turn
        if (lows.length === 1 && (!e16(s) || lows[0] === i)) { const u = has(s, lows[0], 'rooting-for-the-underdog'); if (u) gainVp(s, lows[0], u, 'Rooting for the Underdog'); }
      }
      front(s, { op: 'next', after: i });
    },
    next(s, op) {
      while (s.extra.length) {
        const e = s.extra.shift();
        if (P(s, e.seat).alive) { front(s, { op: 'turn', seat: e.seat, less: e.less, extra: true }); return; }
      }
      const n = s.players.length;
      for (let d = 1; d <= n; d++) {
        const j = (op.after + d) % n;
        if (P(s, j).alive) { front(s, { op: 'turn', seat: j, less: 0 }); return; }
      }
    },
  };

  // ------------------------------------------------------------------ dice helpers
  function rollDice(s, idxs, rng) {
    for (const k of idxs) s.t.dice[k].f = FACES[rint(rng, 6)];
    s.t.rollId = (s.t.rollId || 0) + 1;
    s.t.rolledIdx = idxs.slice();
  }
  function rerollOptions(s) {
    const t = s.t, i = t.seat, p = P(s, i);
    const o = [];
    if (t.rerolls > 0) o.push('normal');
    const smoke = insts(s, i, 'smoke-cloud').find(c => (c.c || 0) > 0);
    if (smoke) o.push('smoke');
    if (!t.tele && has(s, i, 'telepath') && p.en >= 1) o.push('telepath');
    if (has(s, i, 'background-dweller') && t.dice.some(d => d.f === '3')) o.push('dweller');
    return o;
  }

  // ------------------------------------------------------------------ actions
  function rapid(s, seat) {
    const p = P(s, seat);
    if (!has(s, seat, 'rapid-healing')) fail('You need Rapid Healing');
    if (p.en < 2) fail('Not enough energy');
    if (p.hp >= maxHp(s, seat)) fail('Already at full health');
    p.en -= 2;
    heal(s, seat, 1, 'Rapid Healing');
  }

  function doBuy(s, seat, id, inst, action, rng) {
    const p = P(s, seat);
    const card = CD(s, id);
    log(s, seat, 'buys ' + card.name);
    fx(s, { k: 'buy', s: seat, id });
    const dnt = has(s, seat, 'dedicated-news-team');
    if (dnt) gainVp(s, seat, dnt, CD(s, 'dedicated-news-team').name);
    if (card.keep) {
      const c = inst || newInst(s, id);
      // 2016 Parasitic Tentacles: a taken Smoke Cloud / Battery Monster starts fresh
      if (inst && e16(s)) charge(s, c, id);
      p.cards.push(c);
      if (id === 'even-bigger') heal(s, seat, 2, 'Even Bigger');
      if (id === 'monster-batteries' && !inst) {
        if (e16(s)) { c.c = 6; log(s, seat, 'puts 6 bank energy on Battery Monster'); }
        else {
          const amt = Math.max(0, Math.min(p.en, (action && action.amount) | 0));
          p.en -= amt; c.c = 2 * amt;
          log(s, seat, 'charges Monster Batteries with ' + c.c + ' energy');
          if (!c.c) discardInst(s, seat, c);
        }
      }
      if (id === 'mimic' && !inst) {
        const targets = mimicTargets(s, seat);
        if (targets.length) { front(s, { op: 'noop' }); ask(s, 'mimic', [seat], { k: c.k }); }
      }
      return;
    }
    s.discard.push(id);
    cardEffect(s, seat, id, rng);
  }
  function mimicTargets(s, seat) {
    const r = [];
    for (const i of aliveSeats(s)) for (const c of P(s, i).cards) if (c.id !== 'mimic' && CD(s, c.id).keep) r.push({ seat: i, k: c.k, id: c.id });
    return r;
  }
  // Mimic counts as a copy of the card "as if just bought": it gets its own fresh tokens
  function setMimic(s, seat, k, mk) {
    const m = P(s, seat).cards.find(c => c.k === mk);
    const f = findInst(s, k);
    if (!m || !f || f.card.id === 'mimic') fail('Pick a keep card in play');
    m.t = k;
    charge(s, m, f.card.id);
    log(s, seat, 'Mimic copies ' + CD(s, f.card.id).name);
    if (f.card.id === 'even-bigger') heal(s, seat, 2, 'Even Bigger');
  }
  function cardEffect(s, i, id, rng) {
    const others = aliveSeats(s).filter(j => j !== i);
    const selfHit = a => s.q.unshift({ op: 'dmg', hits: [{ s: i, a }], src: i, kind: 'takes', st: 0 });
    switch (id) {
      case 'apartment-building': gainVp(s, i, 3); break;
      case 'commuter-train': gainVp(s, i, 2); break;
      case 'corner-store': gainVp(s, i, 1); break;
      case 'skyscraper': gainVp(s, i, 4); break;
      case 'energize': gainEn(s, i, 9); break;
      case 'evacuation-orders': for (const j of others) loseVp(s, j, 5); log(s, i, 'everyone else loses 5 points'); break;
      case 'fire-blast': s.q.unshift({ op: 'dmg', hits: others.map(j => ({ s: j, a: 2 })), src: i, kind: CD(s, id).name + ':', st: 0 }); break;
      case 'frenzy':
        if (e16(s) && s.t && s.t.seat === i && s.ask == null && s.t.done) { s.t.frenzy = true; log(s, i, 'Frenzy: the turn ends now and another one starts'); }
        else { s.extra.push({ seat: i, less: 0, why: 'frenzy' }); log(s, i, 'Frenzy: another turn after this one'); }
        break;
      case 'gas-refinery': gainVp(s, i, 2); s.q.unshift({ op: 'dmg', hits: others.map(j => ({ s: j, a: 3 })), src: i, kind: 'Gas Refinery:', st: 0 }); break;
      case 'heal': heal(s, i, 2, 'Heal'); break;
      case 'high-altitude-bombing': s.q.unshift({ op: 'dmg', hits: aliveSeats(s).map(j => ({ s: j, a: 3 })), src: i, kind: 'High Altitude Bombing:', st: 0 }); break;
      case 'jet-fighters': gainVp(s, i, 5); selfHit(4); break;
      case 'national-guard': gainVp(s, i, 2); selfHit(2); break;
      case 'nuclear-power-plant': gainVp(s, i, 2); heal(s, i, 3, 'Nuclear Power Plant'); break;
      case 'tanks': gainVp(s, i, 4); selfHit(3); break;
      case 'vast-storm': gainVp(s, i, 2); for (const j of others) { const l = Math.floor(P(s, j).en / 2); P(s, j).en -= l; } log(s, i, 'Vast Storm: everyone else loses half their energy'); break;
      case 'death-from-above':
        gainVp(s, i, 2);
        if (e16(s)) {
          // 2016: take Tokyo City; every other monster in Tokyo must leave (so Bay ends up empty)
          if (s.tokyo.city !== i) {
            for (const spot of ['city', 'bay']) { const o = s.tokyo[spot]; if (o >= 0 && o !== i) { s.tokyo[spot] = -1; log(s, o, 'is forced out of Tokyo'); } }
            enter(s, i, 'city');
          }
        } else if (!inTokyo(s, i)) {
          // 2011 Drop from High Altitude: take Tokyo City unless you are already in Tokyo
          const old = s.tokyo.city;
          if (old >= 0) { s.tokyo.city = -1; log(s, old, 'is thrown out of Tokyo City'); }
          enter(s, i, 'city');
        }
        break;
      default: fail('unknown card ' + id);
    }
  }
  function apply(state, seat, action, rng) {
    const s = state;
    if (s.over) fail('The game is over');
    if (!s.ask || !s.ask.seats.includes(seat) || s.ask.ans[seat]) fail('Not your decision');
    if (!action || typeof action !== 'object' || typeof action.t !== 'string') fail('Bad move');
    s.fx = [];
    s._rng = rng;
    const a = s.ask, t = s.t, p = P(s, seat);
    switch (a.type) {
      case 'start':
        if (action.t === 'rapid') { rapid(s, seat); break; }
        if (action.t === 'mimic') {
          const m = p.cards.find(c => c.id === 'mimic');
          if (!m) fail('You have no Mimic');
          if (p.en < 1) fail('Switching Mimic costs 1 energy');
          if (m.t === action.k) fail('Already copying that');
          p.en -= 1; setMimic(s, seat, action.k, m.k); break;
        }
        if (action.t !== 'roll') fail('Roll first');
        t.n = diceCount(s, seat, t.less);
        t.dice = Array.from({ length: t.n }, () => ({ f: '1', k: false }));
        rollDice(s, t.dice.map((_, k) => k), rng);
        t.rolled = true;
        t.rerolls = 2 + has(s, seat, 'giant-brain');
        s.ask = null;
        log(s, seat, 'rolls ' + t.dice.map(d => d.f).join(' '));
        if (!t.n) { t.done = true; front(s, { op: 'probe' }, { op: 'ray' }, { op: 'resolve' }, { op: 'enter' }, { op: 'buy' }); break; }
        ask(s, 'roll', [seat]);
        break;
      case 'roll':
        if (action.t === 'rapid') { rapid(s, seat); break; }
        if (action.t === 'reroll') {
          const keep = Array.isArray(action.keep) ? action.keep : [];
          if (!keep.every(k => Number.isInteger(k) && k >= 0 && k < t.dice.length) || new Set(keep).size !== keep.length) fail('Bad dice');
          const re = t.dice.map((_, k) => k).filter(k => !keep.includes(k));
          if (!re.length) fail('Pick at least one die to reroll');
          const opts = rerollOptions(s);
          let use = action.use || opts[0];
          if (!opts.includes(use)) fail('No rerolls left');
          if (use === 'dweller' && !re.every(k => t.dice[k].f === '3')) {
            if (t.rerolls > 0) use = 'normal'; else fail('Background Dweller only rerolls 3s');
          }
          if (use === 'normal') t.rerolls--;
          else if (use === 'smoke') { const c = insts(s, seat, 'smoke-cloud').find(x => (x.c || 0) > 0); c.c--; if (!c.c && c.id === 'smoke-cloud') discardInst(s, seat, c); log(s, seat, 'uses a Smoke Cloud charge'); }
          else if (use === 'telepath') { p.en -= 1; t.tele = true; log(s, seat, 'pays 1 ⚡ for Telepath'); }
          t.dice.forEach((d, k) => { d.k = keep.includes(k); });
          rollDice(s, re, rng);
          log(s, seat, 'rerolls: ' + t.dice.map(d => d.f).join(' '));
          if (!rerollOptions(s).length) { /* no rerolls left: still asks so the player can use changes, then done */ }
          break;
        }
        if (action.t === 'change') {
          const k = action.i, f = action.f;
          if (!Number.isInteger(k) || k < 0 || k >= t.dice.length || !FACES.includes(f)) fail('Bad die');
          if (action.via === 'herd') {
            if (!has(s, seat, 'herd-culler') || t.herd) fail('Herd Culler is used up this turn');
            if (f !== '1') fail('Herd Culler makes a 1');
            t.herd = true;
          } else if (action.via === 'stretchy') {
            if (!has(s, seat, 'stretchy') || p.en < 2) fail('Stretchy needs 2 energy');
            p.en -= 2;
          } else if (action.via === 'plot') {
            const c = insts(s, seat, 'plot-twist')[0];
            if (!c) fail('You have no Plot Twist');
            discardInst(s, seat, c);
          } else fail('Bad change');
          log(s, seat, 'turns a ' + t.dice[k].f + ' into a ' + f);
          t.dice[k].f = f;
          break;
        }
        if (action.t === 'done') {
          s.ask = null;
          t.done = true;
          front(s, { op: 'probe' }, { op: 'ray' }, { op: 'resolve' }, { op: 'enter' }, { op: 'buy' });
          break;
        }
        fail('Bad move');
        break;
      case 'probe': {
        if (action.t === 'probe' && !(Number.isInteger(action.i) && action.i >= 0 && action.i < t.dice.length)) fail('Bad die');
        t.probed.push(seat);
        s.ask = null;
        if (action.t === 'probe') {
          const k = action.i;
          const before = t.dice[k].f;
          rollDice(s, [k], rng);
          log(s, seat, 'Psychic Probe rerolls a ' + before + ': ' + t.dice[k].f);
          if (t.dice[k].f === 'H') { const c = insts(s, seat, 'psychic-probe')[0]; discardInst(s, seat, c); log(s, seat, 'Psychic Probe is used up (heart)'); }
        } else if (action.t !== 'pass') fail('Bad move');
        break;
      }
      case 'ray': {
        if (action.t !== 'ray') fail('Bad move');
        const hearts = t.dice.filter(d => d.f === 'H').length;
        const plan = action.heal && typeof action.heal === 'object' ? action.heal : {};
        let used = 0;
        for (const k of Object.keys(plan)) {
          const j = +k, n = plan[k] | 0;
          if (n <= 0) continue;
          if (!(j >= 0 && j < s.players.length) || j === seat || !P(s, j).alive) fail('Bad target');
          used += n;
          if (used > hearts) fail('Not that many hearts');
        }
        for (const k of Object.keys(plan)) {
          const j = +k, n = plan[k] | 0;
          if (n <= 0) continue;
          const healed = heal(s, j, n, 'Healing Ray from ' + p.name);
          const pay = Math.min(P(s, j).en, 2 * healed);
          P(s, j).en -= pay; p.en += pay;
          if (pay) log(s, j, 'pays ' + pay + ' ⚡ for the healing');
        }
        t.rayUsed = used;
        s.ask = null;
        break;
      }
      case 'wings':
      case 'yield':
        if (a.type === 'wings' && action.t !== 'wings') fail('Bad move');
        if (a.type === 'yield' && action.t !== 'yield') fail('Bad move');
        a.ans[seat] = a.type === 'wings' ? { use: !!action.use } : { leave: !!action.leave };
        if (a.type === 'yield') log(s, seat, action.leave ? 'chooses to leave Tokyo' : 'stays in Tokyo');
        if (a.seats.every(x => a.ans[x])) { s.answers = a.ans; s.ask = null; }
        break;
      case 'mimic':
        if (action.t !== 'mimic') fail('Bad move');
        setMimic(s, seat, action.k, a.k);
        s.ask = null;
        break;
      case 'opp': {
        if (action.t !== 'buy' && action.t !== 'pass') fail('Bad move');
        const id = s.market[a.i];
        const cost = costFor(s, seat, id);
        if (action.t === 'buy' && p.en < cost) fail('Not enough energy');
        s.ask = null;
        if (action.t === 'pass') break;
        p.en -= cost;
        s.market[a.i] = null;
        log(s, seat, 'Opportunist!');
        s.q.shift(); // drop the pending opp step for this slot; the refill brings a fresh one
        front(s, { op: 'refill', i: a.i });
        doBuy(s, seat, id, null, action, rng); // its effects run before the refill
        break;
      }
      case 'buy': {
        if (action.t === 'rapid') { rapid(s, seat); break; }
        if (action.t === 'buy' || action.t === 'top') {
          let id, slot = -1;
          if (action.t === 'top') {
            if (!has(s, seat, 'made-in-a-lab')) fail('You need Made in a Lab');
            if (!s.deck.length) fail('The deck is empty');
            id = s.deck[s.deck.length - 1];
          } else {
            slot = action.i;
            if (!(slot >= 0 && slot < 3) || !s.market[slot]) fail('No card there');
            id = s.market[slot];
          }
          const cost = costFor(s, seat, id);
          if (p.en < cost) fail('Not enough energy');
          p.en -= cost;
          if (slot >= 0) s.market[slot] = null; else s.deck.pop();
          s.ask = null;
          front(s, { op: 'buy' });
          if (slot >= 0) front(s, { op: 'refill', i: slot });
          doBuy(s, seat, id, null, action, rng);
          break;
        }
        if (action.t === 'steal') {
          if (!has(s, seat, 'parasitic-tentacles')) fail('You need Parasitic Tentacles');
          const f = findInst(s, action.k);
          if (!f || f.seat === seat) fail('Pick another monster’s card');
          const cost = costFor(s, seat, f.card.id);
          if (p.en < cost) fail('Not enough energy');
          p.en -= cost; P(s, f.seat).en += cost;
          const from = P(s, f.seat);
          from.cards.splice(from.cards.indexOf(f.card), 1);
          lostCard(s, f.seat, f.card.id);
          log(s, seat, 'takes ' + CD(s, f.card.id).name + ' from ' + from.name + ' (Parasitic Tentacles)');
          s.ask = null;
          front(s, { op: 'buy' });
          doBuy(s, seat, f.card.id, f.card, action, rng);
          break;
        }
        if (action.t === 'sweep') {
          if (p.en < 2) fail('Sweeping costs 2 energy');
          p.en -= 2;
          for (const id of s.market) if (id) s.discard.push(id);
          s.market = [null, null, null];
          log(s, seat, 'pays 2 ⚡ to sweep the cards');
          s.ask = null;
          front(s, { op: 'refill', i: 0 }, { op: 'refill', i: 1 }, { op: 'refill', i: 2 }, { op: 'buy' });
          break;
        }
        if (action.t === 'end') {
          const sell = Array.isArray(action.sell) ? action.sell : [];
          if (sell.length) {
            if (!has(s, seat, 'metamorph')) fail('You need Metamorph');
            for (const k of sell) {
              const c = p.cards.find(x => x.k === k);
              if (!c) fail('Not your card');
              discardInst(s, seat, c);
              p.en += CD(s, c.id).cost;
              log(s, seat, 'Metamorph: discards ' + CD(s, c.id).name + ' for ' + CD(s, c.id).cost + ' ⚡');
            }
          }
          s.ask = null;
          front(s, { op: 'endTurn', st: 0 });
          break;
        }
        fail('Bad move');
        break;
      }
      default: fail('Bad state');
    }
    tidy(s);
    checkEnd(s);
    if (!s.over && !s.ask) run(s, rng);
    delete s._rng;
    return s;
  }
  OPS.noop = () => {};
  OPS.refill = (s, op, rng) => {
    if (!s.deck.length && s.discard.length) { s.deck = shuffle(s.discard.splice(0), rng); log(s, -1, 'The discard pile is shuffled into a new deck'); }
    s.market[op.i] = s.deck.length ? s.deck.pop() : null;
    if (s.market[op.i]) s.q.unshift({ op: 'opp', i: op.i });
  };

  const toAct = s => (s.over || !s.ask ? [] : s.ask.seats.filter(x => !s.ask.ans[x]));

  // everything everyone may see (no deck order)
  function publicView(s) {
    const t = s.t;
    return {
      edition: s.edition, n: s.n, bayRule: s.bayRule, duel: !!s.duel, bayOpen: bayOpen(s), level: s.level,
      players: s.players.map((p, i) => ({
        name: p.name, kind: p.kind, mon: p.mon, hp: p.hp, maxHp: maxHp(s, i), vp: p.vp, en: p.en, alive: p.alive,
        poison: p.poison, shrink: p.shrink, wings: p.wings,
        cards: p.cards.map(c => Object.assign({ id: c.id, k: c.k }, c.c != null ? { c: c.c } : {}, c.t != null ? { t: c.t, as: mimicId(s, c) } : {})),
      })),
      tokyo: Object.assign({}, s.tokyo), market: s.market.slice(), deckSize: s.deck.length, discardSize: s.discard.length,
      cur: s.cur, turnNo: s.turnNo,
      t: t ? { seat: t.seat, dice: t.dice.map(d => ({ f: d.f, k: d.k })), rerolls: t.rerolls, rolled: t.rolled, done: t.done, less: t.less,
        rollId: t.rollId || 0, rolledIdx: t.rolledIdx || [], herd: t.herd, tele: t.tele, opts: t.rolled && !t.done ? rerollOptions(s) : [] } : null,
      ask: s.ask ? { type: s.ask.type, seats: s.ask.seats.slice(), waiting: toAct(s), i: s.ask.i, dmg: s.ask.dmg, jets: s.ask.jets, k: s.ask.k } : null,
      log: s.log.slice(-40), fx: s.fx.slice(), over: s.over, winners: s.winners.slice(), why: s.why || null, hist: s.hist.slice(),
    };
  }
  // the only secret: Made in a Lab lets its owner see the top card while buying
  function privateView(s, seat) {
    if (s.ask && s.ask.type === 'buy' && s.ask.seats.includes(seat) && s.deck.length && has(s, seat, 'made-in-a-lab'))
      return { top: s.deck[s.deck.length - 1] };
    return {};
  }

  return {
    FACES, WIN_VP, START_HP, setup, apply, toAct, publicView, privateView, run,
    has, maxHp, costFor, inTokyo, bayOpen, aliveSeats, neighbours, mimicTargets, rerollOptions, diceCount, insts, mimicId, findInst,
  };
});
