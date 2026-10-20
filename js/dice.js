/* Dice maths for King of Tokyo: exact odds by dynamic programming over dice multisets.
   A hand of dice is a count vector over the six faces [1, 2, 3, energy, heart, claw].
   value(final counts) is any function; bestKeep() finds the keep that maximises the expected
   value with the rerolls left, assuming the same goal on later rerolls. Everything is exact. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KotDice = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FACES = ['1', '2', '3', 'E', 'H', 'C'];
  const FI = { 1: 0, 2: 1, 3: 2, E: 3, H: 4, C: 5 };

  // all count vectors of k dice over 6 faces, with their multinomial probability
  const outcomeCache = [];
  const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];
  function outcomes(k) {
    if (outcomeCache[k]) return outcomeCache[k];
    const res = [];
    const cur = [0, 0, 0, 0, 0, 0];
    (function rec(face, left) {
      if (face === 5) {
        cur[5] = left;
        let w = FACT[k];
        for (let i = 0; i < 6; i++) w /= FACT[cur[i]];
        res.push({ c: cur.slice(), p: w / Math.pow(6, k) });
        return;
      }
      for (let n = left; n >= 0; n--) { cur[face] = n; rec(face + 1, left - n); }
    })(0, k);
    return (outcomeCache[k] = res);
  }

  // all sub-multisets of a count vector
  function subsets(c) {
    const res = [];
    const cur = [0, 0, 0, 0, 0, 0];
    (function rec(f) {
      if (f === 6) { res.push(cur.slice()); return; }
      for (let n = 0; n <= c[f]; n++) { cur[f] = n; rec(f + 1); }
    })(0);
    return res;
  }
  const key = c => c.join('');
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const sum = c => c.reduce((a, b) => a + b, 0);

  function countsOf(faces) {
    const c = [0, 0, 0, 0, 0, 0];
    for (const f of faces) c[FI[f]]++;
    return c;
  }

  // numeric codes: counts packed base 9 (at most 8 dice), so adding codes adds counts
  const P9 = [1, 9, 81, 729, 6561, 59049];
  const code = c => c[0] + 9 * c[1] + 81 * c[2] + 729 * c[3] + 6561 * c[4] + 59049 * c[5];
  const uncode = x => { const c = []; for (let i = 0; i < 6; i++) { c.push(x % 9); x = Math.floor(x / 9); } return c; };
  const subCache = new Map();
  function subCodes(x) {
    let r = subCache.get(x);
    if (!r) { r = subsets(uncode(x)).map(s => ({ code: code(s), n: sum(s) })); subCache.set(x, r); }
    return r;
  }
  const outCodeCache = [];
  function outCodes(k) {
    return outCodeCache[k] || (outCodeCache[k] = outcomes(k).map(o => ({ code: code(o.c), p: o.p })));
  }

  /* solver(n, value): n dice total, value(counts) -> number.
     Returns { ev(counts, rerolls), keepEv(kept, rerolls), best(counts, rerolls) }. */
  function solver(n, value) {
    const vMemo = new Map(), kMemo = new Map(), fMemo = new Map();
    function fv(x) { let v = fMemo.get(x); if (v === undefined) { v = value(uncode(x)); fMemo.set(x, v); } return v; }
    function evC(x, r) {
      if (r === 0) return fv(x);
      const k = x * 4 + r;
      let v = vMemo.get(k);
      if (v !== undefined) return v;
      v = -Infinity;
      for (const s of subCodes(x)) { const e = keepEvC(s.code, s.n, r); if (e > v) v = e; }
      vMemo.set(k, v);
      return v;
    }
    function keepEvC(kx, kn, r) {
      const k = kx * 4 + r;
      let e = kMemo.get(k);
      if (e !== undefined) return e;
      e = 0;
      for (const o of outCodes(n - kn)) e += o.p * evC(kx + o.code, r - 1);
      kMemo.set(k, e);
      return e;
    }
    const ev = (c, r) => evC(code(c), r);
    const keepEv = (kept, r) => (r === 0 ? fv(code(kept)) : keepEvC(code(kept), sum(kept), r));
    function best(c, r) {
      if (r === 0) return { keep: c.slice(), ev: value(c) };
      let bk = null, bn = -1, be = -Infinity;
      for (const s of subCodes(code(c))) {
        const e = keepEvC(s.code, s.n, r);
        // ties: prefer keeping more dice (fewer surprises)
        if (e > be + 1e-12 || (Math.abs(e - be) <= 1e-12 && s.n > bn)) { be = e; bk = s.code; bn = s.n; }
      }
      return { keep: uncode(bk), ev: be };
    }
    return { ev, keepEv, best };
  }

  /* Probability that the final dice satisfy pred(counts), if you keep `kept` now and on each later
     reroll keep whatever maximises that same probability. */
  function chance(n, kept, rerolls, pred) {
    const s = solver(n, c => (pred(c) ? 1 : 0));
    if (rerolls === 0) return pred(kept) ? 1 : 0;
    return s.keepEv(kept, rerolls);
  }

  // victory points scored by a final count vector (sets of three numbers)
  function setVp(c) {
    let vp = 0;
    for (let i = 0; i < 3; i++) if (c[i] >= 3) vp += (i + 1) + (c[i] - 3);
    return vp;
  }

  // turn a keep count vector into dice indexes (which physical dice to keep)
  function keepIndexes(faces, keepCounts) {
    const left = keepCounts.slice();
    const res = [];
    faces.forEach((f, i) => { const j = FI[f]; if (left[j] > 0) { left[j]--; res.push(i); } });
    return res;
  }

  // chance a single die shows a claw at the end if you keep claws and reroll the rest
  const clawP = r => 1 - Math.pow(5 / 6, r + 1);

  // distribution of claws from n dice when chasing claws with r rerolls (binomial)
  function clawDist(n, r) {
    const p = clawP(r);
    const d = [];
    for (let k = 0; k <= n; k++) d.push(choose(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k));
    return d;
  }
  function choose(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }

  return { FACES, FI, outcomes, subsets, solver, chance, setVp, countsOf, keepIndexes, clawP, clawDist, choose, sum };
});
