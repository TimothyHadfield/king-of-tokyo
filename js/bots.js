/* Computer players for King of Tokyo: Easy, Medium, Hard. They read only what every player can
   see (plus Made in a Lab's own peek). Dice keeps use the exact solver in dice.js; Hard looks two
   rerolls ahead with situation-aware values, Medium one reroll ahead with fixed values, Easy keeps
   greedily with some randomness. Strengths are measured by tools/measure-levels.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'), require('./engine.js'), require('./dice.js'));
  else root.KotBots = factory(root.KotCards, root.KotEngine, root.KotDice);
})(typeof self !== 'undefined' ? self : this, function (Cards, E, D) {
  'use strict';
  const { CARDS } = Cards;
  const FI = D.FI;

  // ---------------------------------------------------------------- shared estimates
  // chance one opponent die ends as a claw when they go after you: measured in sims (tools/measure-claws.js)
  // claw: share of an outside attacker's final dice that are claws (measured by tools/measure-levels.js)
  // stayKo: Hard leaves Tokyo when its knock-out chance before its next turn is above this
  const CFG = { claw: 0.13, stayKo: 0.22 };

  // distribution of total damage the monsters before my next turn deal to me if I stay in Tokyo
  function damageDist(s, me) {
    let dist = [1];
    const n = s.players.length;
    for (let d = 1; d < n; d++) {
      const j = (me + d) % n;
      const p = s.players[j];
      if (!p.alive || E.inTokyo(s, j)) continue;
      const dice = E.diceCount(s, j, 0);
      const bonus = E.has(s, j, 'spiked-tail') + E.has(s, j, 'acid-attack');
      const one = [];
      for (let k = 0; k <= dice; k++) {
        const pk = D.choose(dice, k) * Math.pow(CFG.claw, k) * Math.pow(1 - CFG.claw, dice - k);
        const dmg = k > 0 || E.has(s, j, 'acid-attack') ? k + bonus : 0;
        one[dmg] = (one[dmg] || 0) + pk;
      }
      const next = [];
      dist.forEach((a, x) => { if (!a) return; one.forEach((b, y) => { if (b) next[x + y] = (next[x + y] || 0) + a * b; }); });
      dist = next;
    }
    return dist.map(x => x || 0);
  }
  // chance I'm knocked out before my next turn if I stay in Tokyo (with `hp` health)
  function koChance(s, me, hp) {
    const armor = E.has(s, me, 'armor-plating');
    const dist = damageDist(s, me);
    let p = 0;
    dist.forEach((a, dmg) => { if (dmg >= hp && !(armor && dmg === 1)) p += a; });
    return p;
  }

  // ---------------------------------------------------------------- dice values
  const solverCache = new Map();
  function cachedSolver(n, valKey, value) {
    const key = n + '|' + valKey;
    let sv = solverCache.get(key);
    if (!sv) {
      sv = D.solver(n, value);
      solverCache.set(key, sv);
      if (solverCache.size > 400) solverCache.delete(solverCache.keys().next().value);
    }
    return sv;
  }

  // per-face values for this monster's turn, as small arrays so solvers can be cached
  function turnValues(s, i, lvl) {
    const p = s.players[i];
    const inT = E.inTokyo(s, i);
    const mx = E.maxHp(s, i);
    const n = E.diceCount(s, i, s.t ? s.t.less : 0);
    const missing = mx - p.hp;
    const opps = E.aliveSeats(s).filter(j => j !== i);
    const enW = lvl === 'hard' ? (s.players[i].vp >= 16 ? 0.25 : 0.5) : 0.4;
    // hearts: value of the h-th heart
    const hv = [];
    for (let h = 1; h <= n; h++) {
      let v = 0;
      const tokens = p.poison + p.shrink;
      if (h <= tokens) v = 0.9;
      else if (!inT && h - tokens <= missing) {
        const hpAfter = p.hp + (h - tokens);
        v = lvl === 'hard' ? (hpAfter <= 4 ? 1.3 : hpAfter <= 6 ? 0.85 : hpAfter <= 8 ? 0.45 : 0.25) : 0.6;
      }
      hv.push(v);
    }
    // claws: value of the c-th claw
    const cv = [];
    const extra = E.has(s, i, 'spiked-tail') + (inT ? E.has(s, i, 'urbavore') + E.has(s, i, 'burrowing') : 0) + E.has(s, i, 'acid-attack');
    const nova = E.has(s, i, 'nova-breath') > 0;
    const targets = opps.filter(j => nova || (inT ? !E.inTokyo(s, j) : E.inTokyo(s, j)));
    for (let c = 1; c <= n; c++) {
      let v = 0;
      if (lvl === 'easy') v = inT ? 0.3 : 0.35;
      else {
        for (const j of targets) {
          const hpj = s.players[j].hp;
          const dmgBefore = c - 1 + extra, dmgAfter = c + extra;
          v += 0.22;
          if (dmgAfter >= hpj && dmgBefore < hpj) v += lvl === 'hard' ? 2.5 + s.players[j].vp * 0.08 : 1.2;
        }
        if (!inT && !nova && targets.length && c === 1) {
          // first claw against Tokyo: a chance the occupant leaves and I move in
          const want = p.hp >= 7 ? 0.6 : p.hp >= 5 ? 0.2 : -0.4;
          v += lvl === 'hard' ? want : 0.2;
        }
        if (!inT && !targets.length && c === 1) {
          // Tokyo is empty: I'll enter anyway; claws do nothing now
          v += 0;
        }
      }
      cv.push(Math.round(v * 20) / 20);
    }
    const vpW = 1;
    return { n, enW, hv, cv, vpW, omni: E.has(s, i, 'omnivore') > 0, gourmet: E.has(s, i, 'gourmet'), quills: E.has(s, i, 'poison-quills'), cd: E.has(s, i, 'complete-destruction') };
  }
  function valueFn(tv) {
    return c => {
      let v = D.setVp(c) * tv.vpW;
      if (c[0] >= 3) v += 2 * tv.gourmet;
      if (tv.omni && c[0] && c[1] && c[2]) v += 2;
      if (tv.cd && c[0] && c[1] && c[2] && c[3] && c[4] && c[5]) v += 9 * tv.cd;
      if (tv.quills && c[1] >= 3) v += 0.5 * tv.quills;
      v += c[3] * tv.enW;
      for (let h = 0; h < c[4]; h++) v += tv.hv[h] || 0;
      for (let k = 0; k < c[5]; k++) v += tv.cv[k] || 0;
      return v;
    };
  }
  function solverFor(s, i, lvl) {
    const tv = turnValues(s, i, lvl);
    const key = [lvl, tv.enW, tv.hv.join(','), tv.cv.join(','), tv.omni, tv.gourmet, tv.quills, tv.cd].join('/');
    return { sv: cachedSolver(tv.n, key, valueFn(tv)), tv };
  }

  // ---------------------------------------------------------------- card values (in points)
  const KEEP_VALUE = {
    'acid-attack': 4, 'alien-metabolism': 2.5, 'alpha-monster': 3, 'armor-plating': 2, 'background-dweller': 1.2,
    'burrowing': 2, 'camouflage': 2, 'complete-destruction': 1.2, 'dedicated-news-team': 2, 'eater-of-the-dead': 3,
    'energy-hoarder': 2, 'even-bigger': 3, 'extra-head': 6, 'fire-breathing': 2, 'freeze-time': 2.2, 'friend-of-children': 2.5,
    'giant-brain': 4, 'gourmet': 1.5, 'healing-ray': 1.5, 'herbivore': 3, 'herd-culler': 2, 'it-has-a-child': 4,
    'jets': 2, 'made-in-a-lab': 1.2, 'metamorph': 0.5, 'mimic': 4, 'monster-batteries': 0.8, 'nova-breath': 4,
    'omnivore': 2.5, 'opportunist': 2, 'parasitic-tentacles': 1.5, 'plot-twist': 1.5, 'poison-quills': 1.5, 'poison-spit': 3,
    'psychic-probe': 1.5, 'rapid-healing': 1.5, 'regeneration': 2, 'rooting-for-the-underdog': 2, 'shrink-ray': 3.5,
    'smoke-cloud': 2, 'solar-powered': 1, 'spiked-tail': 3.5, 'stretchy': 2.5, 'telepath': 2.5, 'urbavore': 3,
    'were-only-making-it-stronger': 1.2, 'wings': 3,
  };
  function cardWorth(s, i, id) {
    const p = s.players[i];
    const c = Cards.card(s.edition, id);
    const leader = Math.max(...s.players.filter(x => x.alive).map(x => x.vp));
    const gameLeft = Math.max(0.25, (20 - leader) / 14); // fraction of the game still to come
    const dnt = E.has(s, i, 'dedicated-news-team');
    const hpW = h => (h <= 3 ? 1.4 : h <= 6 ? 0.8 : 0.45);
    const hurt = a => { const left = p.hp - a; if (left <= 0) return 99; return a * hpW(left); };
    const opps = E.aliveSeats(s).filter(j => j !== i);
    const dmgOthers = a => opps.reduce((t, j) => t + (s.players[j].hp <= a ? 2.5 + s.players[j].vp * 0.08 : 0.25 * a), 0);
    let v;
    if (c.keep) {
      v = (KEEP_VALUE[id] || 1.5) * gameLeft;
      if (id === 'it-has-a-child') v = 1.2 + p.vp * 0.15;
      if (id === 'monster-batteries' && s.edition !== '2011') v = 6 * 0.45; // 2016: 6 free energy over 3 turns
      if (id === 'even-bigger') v += Math.min(2, E.maxHp(s, i) - p.hp) * hpW(p.hp);
      if (id === 'extra-head' && E.has(s, i, 'extra-head') >= 2) v = 0;
      if (id === 'mimic' && !E.mimicTargets(s, i).length) v = 0;
    } else {
      switch (id) {
        case 'apartment-building': v = 3; break;
        case 'commuter-train': v = 2; break;
        case 'corner-store': v = 1; break;
        case 'skyscraper': v = 4; break;
        case 'energize': v = 9 * 0.45; break;
        case 'evacuation-orders': v = opps.reduce((t, j) => t + Math.min(5, s.players[j].vp), 0) / Math.max(1, opps.length) * 0.9; break;
        case 'fire-blast': v = dmgOthers(2); break;
        case 'frenzy': v = 3.5; break;
        case 'gas-refinery': v = 2 + dmgOthers(3); break;
        case 'heal': v = Math.min(2, E.maxHp(s, i) - p.hp) * hpW(p.hp); break;
        case 'high-altitude-bombing': v = dmgOthers(3) - hurt(3); break;
        case 'jet-fighters': v = 5 - hurt(4); break;
        case 'national-guard': v = 2 - hurt(2); break;
        case 'nuclear-power-plant': v = 2 + Math.min(3, E.maxHp(s, i) - p.hp) * hpW(p.hp); break;
        case 'tanks': v = 4 - hurt(3); break;
        case 'vast-storm': v = 2 + opps.reduce((t, j) => t + Math.floor(s.players[j].en / 2), 0) * 0.12; break;
        case 'death-from-above': v = 2 + (s.tokyo.city === i ? 0 : p.hp >= 7 ? 2 : p.hp >= 5 ? 0.5 : -2); break;
        default: v = 1;
      }
      // points that win the game right now are worth everything
      const vpGain = { 'apartment-building': 3, 'commuter-train': 2, 'corner-store': 1, skyscraper: 4, 'gas-refinery': 2, 'jet-fighters': 5, 'national-guard': 2, 'nuclear-power-plant': 2, tanks: 4, 'vast-storm': 2, 'death-from-above': 2 }[id] || 0;
      if (vpGain && p.vp + vpGain + dnt >= 20 && v > -50) v = 100;
    }
    return v + dnt;
  }

  // ---------------------------------------------------------------- decisions
  function pickRandom(rng, a) { return a[Math.floor(rng() * a.length)]; }

  function rollDecision(s, i, lvl, rng) {
    const t = s.t;
    const faces = t.dice.map(d => d.f);
    const counts = D.countsOf(faces);
    const opts = E.rerollOptions(s);
    const p = s.players[i];
    // Rapid Healing when low and nothing better to do
    if (lvl !== 'easy' && E.has(s, i, 'rapid-healing') && p.hp <= 3 && p.en >= 2 && p.hp < E.maxHp(s, i)) return { t: 'rapid' };
    if (lvl === 'easy') {
      if (!opts.includes('normal')) return { t: 'done' };
      // keep pairs+ of numbers, claws and energy; reroll the rest; sometimes stop early
      if (rng() < 0.15) return { t: 'done' };
      const keep = [];
      faces.forEach((f, k) => { if (f === 'C' || f === 'E' || (/[123]/.test(f) && counts[FI[f]] >= 2) || (f === 'H' && p.hp < 6)) keep.push(k); });
      if (keep.length === faces.length) return { t: 'done' };
      return { t: 'reroll', keep, use: 'normal' };
    }
    const { sv, tv } = solverFor(s, i, lvl);
    const value = valueFn(tv);
    // free die changes at the end (Hard): Herd Culler, Plot Twist, Stretchy
    const normalLeft = t.rerolls;
    const look = lvl === 'hard' ? Math.min(2, normalLeft) : Math.min(1, normalLeft);
    if (normalLeft > 0) {
      const best = sv.best(counts, look);
      const keepIdx = D.keepIndexes(faces, best.keep);
      if (keepIdx.length === faces.length) return finishDice(s, i, lvl, sv, value, counts, faces, opts);
      return { t: 'reroll', keep: keepIdx, use: 'normal' };
    }
    return finishDice(s, i, lvl, sv, value, counts, faces, opts);
  }
  function finishDice(s, i, lvl, sv, value, counts, faces, opts) {
    const t = s.t, p = s.players[i];
    if (lvl === 'hard') {
      const now = value(counts);
      // extra rerolls that cost something: Smoke Cloud charge (~0.6), Telepath (1 energy)
      for (const use of ['smoke', 'telepath', 'dweller']) {
        if (!opts.includes(use)) continue;
        const best = sv.best(counts, 1);
        const keepIdx = D.keepIndexes(faces, best.keep);
        if (keepIdx.length === faces.length) continue;
        if (use === 'dweller') {
          const re = faces.map((f, k) => k).filter(k => !keepIdx.includes(k));
          if (!re.every(k => faces[k] === '3')) continue;
        }
        const cost = use === 'smoke' ? 0.6 : use === 'telepath' ? 0.5 : 0;
        if (best.ev - now > cost + 0.15) return { t: 'reroll', keep: keepIdx, use };
      }
      // one die change
      const changes = [];
      if (E.has(s, i, 'herd-culler') && !t.herd) changes.push({ via: 'herd', faces: ['1'], cost: 0 });
      if (E.insts(s, i, 'plot-twist').length) changes.push({ via: 'plot', faces: D.FACES, cost: 1.2 });
      if (E.has(s, i, 'stretchy') && p.en >= 2) changes.push({ via: 'stretchy', faces: D.FACES, cost: 1 });
      let bestCh = null, gain = 0.2;
      for (const ch of changes) for (let k = 0; k < faces.length; k++) for (const f of ch.faces) {
        if (f === faces[k]) continue;
        const c2 = counts.slice(); c2[FI[faces[k]]]--; c2[FI[f]]++;
        const g = value(c2) - now - ch.cost;
        if (g > gain) { gain = g; bestCh = { t: 'change', i: k, f, via: ch.via }; }
      }
      if (bestCh) return bestCh;
    }
    return { t: 'done' };
  }

  function yieldDecision(s, i, lvl, rng) {
    const p = s.players[i];
    if (lvl === 'easy') return { t: 'yield', leave: p.hp <= 3 + Math.floor(rng() * 4) };
    if (lvl === 'medium') return { t: 'yield', leave: p.hp <= 5 };
    // Hard: stay unless the knock-out risk is too high; staying when close to 20 is worth more
    if (p.vp >= 18 && p.hp >= 3) return { t: 'yield', leave: koChance(s, i, p.hp) > 0.6 };
    const ko = koChance(s, i, p.hp);
    return { t: 'yield', leave: ko > CFG.stayKo };
  }

  function buyDecision(s, i, lvl, rng, mine) {
    const p = s.players[i];
    if (lvl !== 'easy' && E.has(s, i, 'rapid-healing') && p.hp <= 3 && p.en >= 2 && p.hp < E.maxHp(s, i)) return { t: 'rapid' };
    const offers = [];
    s.market.forEach((id, k) => { if (id) offers.push({ a: { t: 'buy', i: k }, id }); });
    if (mine && mine.top) offers.push({ a: { t: 'top' }, id: mine.top });
    const afford = offers.filter(o => E.costFor(s, i, o.id) <= p.en);
    if (lvl === 'easy') {
      if (!afford.length || rng() < 0.4) return { t: 'end' };
      const o = pickRandom(rng, afford);
      return Object.assign({}, o.a, o.id === 'monster-batteries' ? { amount: 0 } : {});
    }
    const spendW = lvl === 'hard' ? 0.42 : 0.4;
    let best = null, bestGain = lvl === 'hard' ? 0.3 : 0.6;
    for (const o of afford) {
      if (o.id === 'monster-batteries' && s.edition === '2011') continue;
      const w = lvl === 'hard' ? cardWorth(s, i, o.id) : mediumWorth(s, i, o.id);
      const g = w - E.costFor(s, i, o.id) * spendW;
      if (g > bestGain) { bestGain = g; best = o; }
    }
    if (best) return best.a;
    // Hard: sweep a weak market when rich
    if (lvl === 'hard' && p.en >= 8) {
      const top = Math.max(0, ...offers.map(o => cardWorth(s, i, o.id) - E.costFor(s, i, o.id) * spendW));
      if (top < 0 && s.deck.length >= 3) return { t: 'sweep' };
    }
    return { t: 'end' };
  }
  function mediumWorth(s, i, id) {
    const c = Cards.card(s.edition, id);
    const p = s.players[i];
    if (c.keep) return (KEEP_VALUE[id] || 1.5) * 0.8;
    const fixed = { 'apartment-building': 3, 'commuter-train': 2, 'corner-store': 1, skyscraper: 4, energize: 4, 'evacuation-orders': 2.5, 'fire-blast': 1.5,
      frenzy: 3, 'gas-refinery': 3.5, heal: p.hp <= 6 ? 1.6 : 0.3, 'high-altitude-bombing': 0.5, 'jet-fighters': p.hp > 6 ? 2.5 : -5, 'national-guard': p.hp > 4 ? 1 : -5,
      'nuclear-power-plant': 3, tanks: p.hp > 5 ? 2.5 : -5, 'vast-storm': 2.5, 'death-from-above': 2.5 };
    return fixed[id] != null ? fixed[id] : 1;
  }

  function wingsDecision(s, i, lvl, dmg, rng) {
    const p = s.players[i];
    if (lvl === 'easy') return { t: 'wings', use: dmg >= p.hp || rng() < 0.2 };
    return { t: 'wings', use: dmg >= p.hp || (lvl === 'hard' && dmg >= 3 && p.hp <= 6) };
  }

  function probeDecision(s, i) {
    // reroll the die that helps the roller most: part of a set, else a claw aimed at me, else energy
    const t = s.t;
    const faces = t.dice.map(d => d.f);
    const c = D.countsOf(faces);
    let target = -1, score = 0;
    faces.forEach((f, k) => {
      let v = 0;
      if (/[123]/.test(f) && c[FI[f]] === 3) v = +f + 1;
      else if (f === 'C') v = (E.inTokyo(s, i) !== E.inTokyo(s, t.seat)) ? 1.5 : 0.6;
      else if (f === 'E') v = 0.5;
      else if (f === 'H' && !E.inTokyo(s, t.seat)) v = 0.4;
      if (v > score) { score = v; target = k; }
    });
    return target >= 0 && score >= 1 ? { t: 'probe', i: target } : { t: 'pass' };
  }

  function rayDecision(s, i) {
    // heal monsters that can pay, outside the leader
    const hearts = s.t.dice.filter(d => d.f === 'H').length;
    const me = s.players[i];
    const ownNeed = E.inTokyo(s, i) ? 0 : Math.max(0, E.maxHp(s, i) - me.hp - (me.hp >= 8 ? 2 : 0));
    let spare = Math.max(0, hearts - ownNeed - me.poison - me.shrink);
    const heal = {};
    for (const j of E.aliveSeats(s)) {
      if (j === i || spare <= 0) continue;
      const q = s.players[j];
      const n = Math.min(spare, E.maxHp(s, j) - q.hp, Math.floor(q.en / 2));
      if (n > 0 && q.vp < 15) { heal[j] = n; spare -= n; }
    }
    return { t: 'ray', heal };
  }

  function mimicDecision(s, i) {
    const opts = E.mimicTargets(s, i).filter(o => o.seat !== i || true);
    let best = null, bv = -1;
    for (const o of opts) { const v = KEEP_VALUE[o.id] || 1; if (v > bv) { bv = v; best = o; } }
    return { t: 'mimic', k: best ? best.k : opts[0].k };
  }

  function decide(s, seat, lvl, rng, mine) {
    const a = s.ask;
    switch (a.type) {
      case 'start': return { t: 'roll' };
      case 'roll': return rollDecision(s, seat, lvl, rng);
      case 'probe': return lvl === 'easy' ? { t: 'pass' } : probeDecision(s, seat);
      case 'ray': return rayDecision(s, seat);
      case 'wings': return wingsDecision(s, seat, lvl, a.dmg, rng);
      case 'yield': return yieldDecision(s, seat, lvl, rng);
      case 'mimic': return mimicDecision(s, seat);
      case 'opp': {
        const id = s.market[a.i];
        const w = lvl === 'hard' ? cardWorth(s, seat, id) : mediumWorth(s, seat, id);
        return { t: w - E.costFor(s, seat, id) * 0.42 > 0.5 && lvl !== 'easy' ? 'buy' : 'pass' };
      }
      case 'buy': return buyDecision(s, seat, lvl, rng, mine);
      default: throw new Error('bot: unknown ask ' + a.type);
    }
  }

  // ---------------------------------------------------------------- helpers for the screens
  // best keep for a human's dice (balanced Hard values), and points lost by a given keep
  function advise(s, i) {
    const t = s.t;
    if (!t || !t.dice.length) return null;
    const { sv, tv } = solverFor(s, i, 'hard');
    const faces = t.dice.map(d => d.f);
    const counts = D.countsOf(faces);
    const r = Math.min(2, t.rerolls);
    const best = sv.best(counts, r);
    return { keep: D.keepIndexes(faces, best.keep), ev: best.ev, r, sv, tv, value: valueFn(tv), counts, faces };
  }

  return { decide, advise, koChance, damageDist, cardWorth, turnValues, valueFn, KEEP_VALUE, CFG };
});
