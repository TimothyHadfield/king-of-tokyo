/* King of Tokyo Lab: what just happened between two public views, as a list of events for sounds
   and animations. Pure (no DOM), so node tests can drive it with the real engine. The screen plays
   them in app.js (fxReact). Works the same for local and online games: it only compares snapshots. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.KotFx = m;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // identifies one engine step's effect list, so a re-sent identical snapshot plays nothing twice
  const fxKey = p => JSON.stringify([p.turnNo, p.t ? p.t.rollId : 0, p.log.slice(-3), p.fx]);

  // a = previous public view (or null), b = new one, me = this screen's seat
  function events(a, b, me) {
    const out = [];
    if (!b || !b.players) return out;
    if (!a || !a.players) {
      // first view of a fresh game: only the "your turn" chime
      if (!b.over && b.turnNo === 1 && b.cur === me && b.ask && b.ask.type === 'start') out.push({ e: 'turn', s: b.cur, mine: true });
      return out;
    }
    const ta = a.t, tb = b.t, sameTurn = a.turnNo === b.turnNo;
    // the turn passed
    if (!b.over && b.cur >= 0 && (b.cur !== a.cur || !sameTurn)) out.push({ e: 'turn', s: b.cur, mine: b.cur === me });
    // dice thrown (first roll or a reroll), one entry per die that left the hand
    if (tb && tb.rollId > 0 && (!ta || !sameTurn || ta.rollId !== tb.rollId)) out.push({ e: 'roll', s: tb.seat, idx: tb.rolledIdx.slice(), mine: tb.seat === me });
    // a die turned to another face by a card (Herd Culler, Stretchy, Plot Twist, Psychic Probe)
    else if (tb && ta && sameTurn && ta.rollId === tb.rollId && ta.dice.length === tb.dice.length) {
      const ch = tb.dice.map((d, k) => (d.f !== ta.dice[k].f ? k : -1)).filter(k => k >= 0);
      if (ch.length) out.push({ e: 'face', s: tb.seat, idx: ch });
    }
    // the engine's own effect list for this step
    if (fxKey(a) !== fxKey(b)) {
      const sum = {};
      for (const f of b.fx) {
        if (f.k === 'hp' || f.k === 'vp' || f.k === 'en') {
          const key = f.s + f.k + (f.n < 0 ? '-' : '+');
          if (!sum[key]) { sum[key] = { k: f.k, s: f.s, n: 0 }; }
          sum[key].n += f.n;
        } else if (f.k === 'enter') out.push({ e: 'enter', s: f.s, spot: f.spot });
        else if (f.k === 'leave') out.push({ e: 'leave', s: f.s });
        else if (f.k === 'ko') out.push({ e: 'ko', s: f.s });
        else if (f.k === 'reborn') out.push({ e: 'reborn', s: f.s });
        else if (f.k === 'buy') out.push({ e: 'buy', s: f.s, id: f.id });
      }
      const name = { hp: ['dmg', 'heal'], vp: ['vpLoss', 'vp'], en: ['enLoss', 'en'] };
      for (const x of Object.values(sum)) if (x.n) out.push({ e: name[x.k][x.n > 0 ? 1 : 0], s: x.s, n: Math.abs(x.n) });
    }
    // energy spent (buying, Wings, sweeping…): not in the engine's list
    b.players.forEach((p, i) => {
      const was = a.players[i];
      if (was && p.alive && was.alive && p.en < was.en && !out.some(x => x.e === 'enLoss' && x.s === i)) out.push({ e: 'spend', s: i, n: was.en - p.en });
    });
    // new cards on sale: one slot = a refill after a buy, all three = a sweep
    const dealt = b.market.map((id, k) => (id && id !== a.market[k] ? k : -1)).filter(k => k >= 0);
    if (dealt.length) out.push({ e: dealt.length >= 3 && !out.some(x => x.e === 'buy') ? 'sweep' : 'deal', slots: dealt });
    // a decision that is mine although it isn't my turn (stay in Tokyo? Wings?)
    const myAsk = v => (v.ask && !v.over && v.ask.waiting.includes(me) && v.cur !== me ? v.ask.type : null);
    if (myAsk(b) && myAsk(b) !== myAsk(a)) out.push({ e: 'ask', s: me, type: myAsk(b) });
    // game over
    if (b.over && !a.over) out.push({ e: 'over', winners: b.winners.slice(), why: b.why, mine: b.winners.includes(me) });
    return out;
  }
  // King of Tokyo's own synthesised sounds (fx.js define recipes; all under 1.2 s)
  function defineSounds(FX) {
    if (!FX || !FX.define) return;
    // monster roar entering Tokyo: two detuned low sawtooth growls falling in pitch, low-passed, over breathy noise and a sub thump
    FX.define('roar', k => {
      k.tone({ f: 96, f2: 68, dur: 0.95, a: 0.07, type: 'sawtooth', lp: 750, vol: 0.24 });
      k.tone({ f: 147, f2: 101, dur: 0.85, a: 0.07, type: 'sawtooth', lp: 950, vol: 0.15 });
      k.tone({ f: 101, f2: 66, dur: 0.9, a: 0.09, type: 'square', lp: 520, vol: 0.08 });
      k.noise({ f: 650, f2: 240, filter: 'lowpass', dur: 0.95, a: 0.1, vol: 0.4 });
      k.tone({ f: 58, f2: 40, dur: 0.7, vol: 0.32 });
    }, 'moves');
    // claws: a heavy smash with a short scrape on top
    FX.define('smash', k => {
      k.noise({ f: 1400, f2: 200, filter: 'lowpass', dur: 0.26, vol: 0.75 });
      k.tone({ f: 150, f2: 45, dur: 0.28, vol: 0.5 });
      k.noise({ f: 2600, f2: 5200, q: 4, dur: 0.12, vol: 0.22, at: 0.015 });
    }, 'moves');
    // hearts: two soft rising notes
    FX.define('heal', k => {
      k.tone({ f: 660, f2: 880, dur: 0.18, vol: 0.12 });
      k.tone({ f: 990, dur: 0.32, vol: 0.1, at: 0.12 });
      k.tone({ f: 1980, dur: 0.18, vol: 0.02, at: 0.12 });
    }, 'moves');
    // energy: an electric zap (falling saw + crackle)
    FX.define('zap', k => {
      k.tone({ f: 1800, f2: 300, dur: 0.14, type: 'sawtooth', lp: 4000, vol: 0.08 });
      k.noise({ f: 4200, q: 3, dur: 0.08, vol: 0.2 });
      k.tone({ f: 2400, f2: 900, dur: 0.1, type: 'square', lp: 5000, vol: 0.035, at: 0.05 });
    }, 'moves');
    // victory points: a bright two-note sparkle
    FX.define('star', k => {
      k.tone({ f: 1568, dur: 0.18, vol: 0.1, type: 'triangle' });
      k.tone({ f: 2093, dur: 0.26, vol: 0.09, type: 'triangle', at: 0.07 });
      k.tone({ f: 4186, dur: 0.12, vol: 0.025, at: 0.07 });
    }, 'moves');
  }

  // events -> sounds: [{ snd, at (ms after the screen updates), o: FX.play options }]
  // sp = animation speed factor (1 normal, 0.55 fast) so dice sounds land with the tumble animation
  function plan(evs, me, sp) {
    sp = sp || 1;
    const out = [];
    const add = (snd, at, o, s) => out.push({ snd, at: Math.round(at || 0), o: Object.assign({}, o || {}, s != null && s !== me ? { vol: ((o && o.vol) || 1) * 0.85 } : {}) });
    const bought = evs.some(x => x.e === 'buy');
    for (const x of evs) {
      switch (x.e) {
        case 'turn': if (x.mine) add('turn', 0); break;
        case 'ask': add('turn', 0, { pitch: 0.75, vol: 0.7 }); break;
        // one throw per die, each landing when its tumble (CSS delay k*40 ms, lands at ~60% of 0.5 s) shows its face
        case 'roll': x.idx.forEach(k => { add('diceRoll', k * 40 * sp, { vol: 0.55 }, x.s); add('diceLand', (k * 40 + 300) * sp, { vol: 0.7 }, x.s); }); break;
        case 'face': add('place', 0, { pitch: 1.4 }, x.s); break;
        case 'dmg': add('smash', 0, { vol: Math.min(1.4, 0.7 + x.n * 0.1) }, x.s); break;
        case 'heal': add('heal', 60, null, x.s); break;
        case 'en': add('zap', 120, null, x.s); break;
        case 'vp': add('star', 180, null, x.s); break;
        case 'vpLoss': case 'enLoss': add('miss', 0, null, x.s); break;
        case 'spend': if (!bought) add('coins', 0, null, x.s); break;
        case 'enter': add('roar', 0, null, x.s); break;
        case 'leave': add('whoosh', 0, null, x.s); break;
        case 'ko': add('explosion', 0, null, x.s); break;
        case 'reborn': add('heal', 0, null, x.s); add('ding', 200, null, x.s); break;
        case 'buy': add('coins', 0, null, x.s); add('cardDeal', 140, null, x.s); break;
        case 'deal': x.slots.forEach((k, j) => add('cardFlip', (bought ? 320 : 0) + j * 70)); break;
        case 'sweep': add('shuffle', 0); break;
      }
    }
    return out;
  }
  return { events, fxKey, plan, defineSounds };
});
