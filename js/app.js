/* King of Tokyo Lab: screens. Local games run through the shared online module's createLocal
   (same snapshot shape as online rooms), online rooms through createOnline. */
import { createLocal } from './online.js?v=1';

const { CARDS, MONSTERS, EDITIONS } = window.KotCards;
// CARDS holds the names/costs/texts of one edition at a time: the running game's, else the Settings choice
const syncEd = ed => window.KotCards.setEdition(ed || (snap && snap.pub ? snap.pub.edition : store.settings.edition));
const E = window.KotEngine, D = window.KotDice, Bots = window.KotBots, Art = window.KotArt;
const GAME = window.KotGame.game;
const STR = window.KotStrength || {};
const VERSION = '1.1';

// ------------------------------------------------------------------ sound & effects (js/fx.js, js/fx-events.js)
// if either file failed to load, the game still runs, silent and still
const NOFX = (() => { const z = () => Promise.resolve(); return { settings: { animations: false, animSpeed: 'normal' }, init() {}, define() {}, onChange() {}, play: () => false, celebrate: z, pop: z, shake: z, pulse: z, flash: z, countUp: z, renderSettings() {} }; })();
const FX = window.FX || NOFX, KF = window.KotFx || { events: () => [], plan: () => [], defineSounds() {} };
KF.defineSounds(FX);
// dice play their own keep/unkeep knock, so the automatic button tap skips them
FX.init({ game: 'king-of-tokyo', accent: '#6ea8fe', clickSelector: 'button:not([data-die]), [role="button"], .btn' });
const fxSp = () => (FX.settings.animSpeed === 'fast' ? 0.55 : 1);
// the game's own CSS animations (dice tumble, card deal, Tokyo stomp, floats, hit shake) follow the switches too
function fxClasses() {
  const s = FX.settings;
  document.body.classList.toggle('fx-noanim', !s.animations);
  document.body.classList.toggle('fx-fast', s.animations && s.animSpeed === 'fast');
}
FX.onChange(fxClasses); fxClasses();

// ------------------------------------------------------------------ guided first game + rules (js/coach.js, js/tutorial.js)
// if either file failed to load, the game runs without them
const COACH = window.COACH || null, KT = window.KotTutorial || null;
// My stats, achievements and the Daily game (js/profile.js + js/kotprofile.js); optional too
const KP = window.KotProfile || null;
const PF = () => (KP && window.Profile) || null;
// local games draw their dice from a seeded stream whose position is saved with the game, so Undo and a
// reload carry on with the same dice (an undone roll comes back the same, not as a fresh try)
function seeded(a) {
  a = (a >>> 0) || 1;
  const r = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.get = () => a >>> 0;
  return r;
}
const newSeed = () => (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
const TUT_ID = 'kot-first-game';
let tour = null;   // made after `ui` exists (its conditions read the running game)
function openRules(open) { if (COACH && KT) { closePop(); COACH.rules(Object.assign(KT.rules(Art), { open })); } }

// ------------------------------------------------------------------ storage
const KEY = 'kot-lab-v1';
const DEFAULTS = { level: 'medium', edition: '2016', bay: true, duel: false, speed: 'normal', hints: true, name: '', kinds: ['human', 'computer', 'computer', 'computer'] };
function load() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) { o = null; }
  if (!o || typeof o !== 'object') o = {};
  const s = Object.assign({}, DEFAULTS, o.settings && typeof o.settings === 'object' ? o.settings : {});
  if (!['easy', 'medium', 'hard'].includes(s.level)) s.level = 'medium';
  if (!EDITIONS[s.edition]) s.edition = '2016';
  if (!['normal', 'fast'].includes(s.speed)) s.speed = 'normal';
  s.bay = s.bay !== false; s.hints = s.hints !== false; s.duel = s.duel === true;
  s.name = typeof s.name === 'string' ? s.name.slice(0, 20) : '';
  if (!Array.isArray(s.kinds) || s.kinds.length < 2 || s.kinds.length > 6 || !s.kinds.every(k => k === 'human' || k === 'computer')) s.kinds = DEFAULTS.kinds.slice();
  if (!s.kinds.includes('human')) s.kinds[0] = 'human';
  const saved = o.saved && typeof o.saved === 'object' && o.saved.state && Array.isArray(o.saved.kinds) ? o.saved : null;
  const keepSel = o.keepSel && typeof o.keepSel === 'object' && typeof o.keepSel.key === 'string' && Array.isArray(o.keepSel.keep) ? o.keepSel : null;
  return { settings: s, saved, online: !!o.online, study: Array.isArray(o.study) ? o.study.slice(-200) : [], keepSel, recOnline: typeof o.recOnline === 'string' ? o.recOnline.slice(0, 40) : '' };
}
const store = load();
// each seat's monster: distinct, one per seat
function fixMons() {
  const st = store.settings;
  let m = Array.isArray(st.mons) ? st.mons.filter((x, i, a) => Number.isInteger(x) && x >= 0 && x < 6 && a.indexOf(x) === i) : [];
  for (let k = 0; m.length < st.kinds.length && k < 6; k++) if (!m.includes(k)) m.push(k);
  st.mons = m.slice(0, st.kinds.length);
}
fixMons();
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private mode: play on without saving */ } }

// ------------------------------------------------------------------ helpers
const $ = (sel, el) => (el || document).querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = x => (x >= 0.995 && x < 1 ? '>99' : x > 0 && x < 0.005 ? '<1' : Math.round(x * 100)) + '%';
const fmt1 = x => (Math.round(x * 10) / 10).toFixed(1);
// red → green scale for a 0..1 goodness value
function scale(g) { g = Math.max(0, Math.min(1, g)); const h = Math.round(g * 130); return `hsl(${h} 70% 62%)`; }
function toast(msg) {
  msg = String(msg);
  const old = $('.toast');
  // the same message from two places (an action's result and the room's error event) shows once
  if (old && old.textContent === msg) { clearTimeout(old._t); old._t = setTimeout(() => old.remove(), 2600); return; }
  if (old) old.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  t._t = setTimeout(() => t.remove(), 2600);
}

// tap guard: a quick second tap (double tap / double-click) must not land on whatever was just drawn
// in the same spot (Roll -> Reroll, Reroll -> the next Reroll, a card -> its Buy sheet). Taps elsewhere pass.
// A slow phone can take longer than any fixed window to draw, so the guard also counts from when the
// new screen was first shown: a tap there that comes before it has been visible for 300 ms is the
// second half of a double tap, not a choice (shown = Infinity while the redraw is still unseen).
const tapGuard = { t: -1e9, x: 0, y: 0, el: null, shown: -1e9, seq: 0 };
function markDrawn() {
  const g = tapGuard;
  if (g.shown !== Infinity && g.shown > g.t) return; // only the first redraw after a tap counts
  g.shown = Infinity;
  const seq = ++g.seq;
  requestAnimationFrame(() => setTimeout(() => { if (seq === g.seq) g.shown = performance.now(); }, 0));
}
document.addEventListener('click', e => {
  const tgt = e.target && e.target.closest ? e.target : null;
  if (!tgt || !tgt.closest('#v-play, #sheet')) return;
  const g = tapGuard, now = performance.now();
  const near = Math.abs(e.clientX - g.x) < 44 && Math.abs(e.clientY - g.y) < 44;
  const redrawn = g.el && tgt !== g.el && (!g.el.isConnected || (!!tgt.closest('#sheet') && !g.el.closest('#sheet')));
  if (near && redrawn && (now - g.t < 450 || now < g.shown + 300)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return; }
  g.t = now; g.x = e.clientX; g.y = e.clientY; g.el = tgt; g.shown = -1e9;
}, true);
function costTag(n) { return `<span class="cost">${Art.icon('E', 14)}${n}</span>`; }
const DIE_INK = '#5fd36e'; // the real dice: green symbols on black
const monName = i => MONSTERS[i] ? MONSTERS[i].name : 'Monster';

// ? popovers
let popEl = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
document.addEventListener('click', e => {
  const q = e.target.closest('.q[data-tip]'); // the Sound "?" (fx.js) opens its own line instead
  if (q) {
    e.stopPropagation(); closePop();
    popEl = document.createElement('div'); popEl.className = 'pop'; popEl.innerHTML = q.dataset.tip; document.body.appendChild(popEl);
    const r = q.getBoundingClientRect(), w = popEl.offsetWidth, h = popEl.offsetHeight;
    let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left - w / 2 + 10)), y = r.bottom + 8;
    if (y + h > window.innerHeight - 10) y = r.top - h - 8;
    popEl.style.left = x + 'px'; popEl.style.top = Math.max(8, y) + 'px';
    return;
  }
  if (popEl && !e.target.closest('.pop')) closePop();
}, true);
const qTip = t => `<button class="q" data-tip="${esc(t)}" aria-label="Why?">?</button>`;

// sheets
function openSheet(html, onMount) {
  closeSheet();
  const b = document.createElement('div'); b.className = 'sheet-back'; b.id = 'sheet';
  b.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  b.addEventListener('click', e => { if (e.target === b) closeSheet(); });
  document.body.appendChild(b);
  if (onMount) onMount(b.firstElementChild);
  ui.sheetOpen = true;
  markDrawn();
}
function closeSheet() { const s = $('#sheet'); if (s) s.remove(); ui.sheetOpen = false; ui.sheetKind = null; }

// ------------------------------------------------------------------ app state
const ui = { tab: 'play', mode: null, keep: new Set(), lastRoll: null, change: null, fxKey: '', marketSeen: [], sheetOpen: false, sheetKind: null, autoDone: null, lobbyN: null, connecting: false, endShown: false };
// the running game's extras: Undo (local, not the Daily or the guided game), whether it counts in My stats,
// and the turn-by-turn timeline for the end-of-game review
ui.game = null;
function newMeta(o) { return Object.assign({ gid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), daily: null, helped: false, recorded: false, moved: false, tokyoTurns: 0, tl: [], undo: null }, o || {}); }
function cleanMeta(m) {
  if (!m || typeof m !== 'object') return newMeta();
  const o = newMeta();
  if (typeof m.gid === 'string') o.gid = m.gid.slice(0, 24);
  if (typeof m.daily === 'string' && /^\d{4}-\d\d-\d\d$/.test(m.daily)) o.daily = m.daily;
  o.helped = m.helped === true; o.recorded = m.recorded === true; o.moved = m.moved === true;
  o.tokyoTurns = Number.isInteger(m.tokyoTurns) ? m.tokyoTurns : 0;
  o.tl = Array.isArray(m.tl) ? m.tl.filter(f => f && Number.isInteger(f.n) && Array.isArray(f.p)).slice(-160) : [];
  o.undo = m.undo && m.undo.state && Array.isArray(m.undo.state.players) ? m.undo : null;
  return o;
}
let room = null;     // local room (createLocal) or online room
let snap = null;     // latest snapshot
const net = { room: null };

// the coach follows the tutorial game's own state; it steps aside on other tabs and while a sheet is open
if (COACH && KT) {
  const tctx = {
    pub: () => (snap && snap.pub) || null,
    me: () => (snap ? snap.mySeat : 0),
    ask: () => (snap && snap.pub ? myAsk() : null),
    inTokyo: i => !!(snap && snap.pub && (snap.pub.tokyo.city === i || snap.pub.tokyo.bay === i)),
  };
  tour = COACH.tour({
    id: TUT_ID, steps: KT.steps(tctx),
    pauseIf: () => ui.tab !== 'play' || ui.sheetOpen || !ui.tut || !snap || !snap.pub,
    onFinish: () => { ui.tut = false; },
  });
}
// a stacked first game against two Easy computers, with the coach on top
function startTutorial() {
  if (!tour) return;
  closeSheet(); if (COACH) COACH.closeOffer();
  if (ui.mode === 'online') { toast('Leave the online room first.'); return; }
  store.saved = null; save();
  tour.reset();
  if (ui.tab !== 'play') setTab('play', true);
  startLocal(null, false, true);
  if (ui.tut) tour.start();
}

// ------------------------------------------------------------------ tabs + back button
function setTab(t, push) {
  if (!['play', 'odds', 'cards', 'settings'].includes(t)) t = 'play';
  ui.tab = t;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + t));
  if (push) history.pushState({ tab: t }, '', '#' + t);
  closeSheet(); closePop();
  if (COACH && t !== 'play') COACH.closeOffer();
  render();
}
document.getElementById('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab, true); });
// Back with a sheet open only closes the sheet: the address goes back to the tab that is still shown
window.addEventListener('popstate', () => {
  if (ui.pfOpen) { ui.pfOpen = false; if (window.Profile && window.Profile.isOpen()) window.Profile.closePanel(); return; }
  if (COACH && COACH.rulesOpen()) { COACH.closeRules(); history.pushState({ tab: ui.tab }, '', '#' + ui.tab); return; }
  if (ui.sheetOpen) { closeSheet(); history.pushState({ tab: ui.tab }, '', '#' + ui.tab); return; }
  setTab((location.hash || '#play').slice(1), false);
});

function render() {
  if (ui.tab === 'play') renderPlay();
  else if (ui.tab === 'odds') renderOdds();
  else if (ui.tab === 'cards') renderCards();
  else renderSettings();
}

// ================================================================== PLAY
// ?botms=N in the address overrides the computers' pace (used by the automated screen tests)
const BOTMS = (() => { try { const v = +new URLSearchParams(location.search).get('botms'); return v > 0 ? v : 0; } catch (e) { return 0; } })();
function speedMs() { return BOTMS || (store.settings.speed === 'fast' ? 320 : 750); }

function startLocal(resume, quiet, tutorial, daily) {
  closeRoom();
  if (COACH) COACH.closeOffer();
  const st = store.settings;
  // the guided first game: fixed seats and options, and the scripted dice (rebuilt the same way after a reload)
  const tut = !!(KT && COACH && (tutorial || (resume && resume.tut)));
  const meta = resume ? cleanMeta(resume.meta) : newMeta(daily ? { daily: daily.day } : null);
  // today's Daily: you + 3 Medium, 2016 rules, the same deal and dice for everyone that day
  const kinds = resume ? resume.kinds : tut ? KT.KINDS.slice() : daily ? ['human', 'computer', 'computer', 'computer'] : st.kinds.slice();
  let hn = 0;
  const seats = kinds.map((k, i) => ({ kind: k, name: k === 'human' ? (kinds.filter(x => x === 'human').length > 1 ? 'Player ' + (++hn) : (st.name || 'You')) : 'Computer' }));
  let g = resume ? Object.assign({}, GAME, { setup: () => resume.state }) : GAME;
  let rng = seeded(resume && Number.isInteger(resume.rs) ? resume.rs : daily ? daily.seed : newSeed());
  if (tut) { rng = COACH.rng(KT.SEED); g = KT.rigGame(g, rng); }
  ui.rng = tut ? null : rng;
  // computers get their monster's name
  ui.restoring = !!resume;
  try {
    fixMons();
    const dm = daily ? [st.mons[0]].concat([0, 1, 2, 3, 4, 5].filter(m => m !== st.mons[0])).slice(0, 4) : null;
    const options = tut ? Object.assign({}, KT.OPTIONS, { monsters: KT.monsters(st.mons[0]) })
      : daily ? { edition: KP.DAILY.edition, level: KP.DAILY.level, bay: true, duel: false, monsters: dm }
      : { edition: st.edition, level: st.level, bay: st.bay, duel: st.duel, monsters: st.mons };
    ui.tut = tut;
    ui.game = meta;
    room = createLocal({ game: g, seats, options, botDelayMs: speedMs(), rng });
    ui.mode = 'local'; ui.endShown = false; ui.keep = new Set(); ui.lastRoll = null; ui.fxKey = '';
    if (!quiet) ui.marketSeen = [];
    if (!resume) { store.study = []; store.keepSel = null; }
    room.on('change', s => onSnap(s));
    room.on('error', e => toast(String(e && e.message || e)));
    // a resumed game is restored and drawn inside this try: a broken save fails here, not later
    room.start();
    if (resume && !quiet && (!snap || !snap.pub || !document.querySelector('#v-play #game'))) throw new Error('nothing drawn');
  } catch (e) { ui.restoring = false; ui.tut = false; ui.game = null; restoreFailed(); return; }
  ui.restoring = false;
}
function restoreFailed() {
  closeRoom(); store.saved = null; save();
  toast('Couldn’t restore the saved game.');
  if (ui.tab === 'play') renderPlay();
}
function closeRoom() {
  if (room && room.mode === 'local' && room.close) room.close();
  room = null; snap = null; ui.mode = null; ui.game = null;
  clearTimeout(ui.autoDone);
  // the coach hides with its game (its place is kept: the saved tutorial game resumes it)
  ui.tut = false; if (tour && tour.active) tour.stop();
}
// the tutorial game was quit or finished: the coach is done too
function endTutorial() { if (tour && (tour.active || tour.saved())) tour.finish('skip'); ui.tut = false; }
function onSnap(s) {
  const prev = snap && snap.pub ? snap.pub : null;
  snap = s;
  try { track(prev, s); } catch (e) { /* the review and stats are extras */ }
  if (ui.mode === 'local' && room && room.state) {
    if (s.status === 'finished') store.saved = null;
    else store.saved = Object.assign({ state: room.state, kinds: room.state.players.map(p => p.kind), meta: ui.game }, ui.rng ? { rs: ui.rng.get() } : {}, ui.tut ? { tut: true } : {});
    save();
  }
  if (s.pub && s.pub.over) recordGame();
  try { trackDiscards(prev, s.pub); } catch (e) { /* the pile is decoration */ }
  const was = ui.tab === 'play' ? grabMarket() : [];
  if (ui.tab === 'play') renderPlay();
  fxReact(prev, s, was);
}
// where each market card sat before a redraw, so a bought card can glide from there
function grabMarket() {
  return [...document.querySelectorAll('#v-play #market [data-slot]')].map(el => ({ id: el.dataset.id, slot: +el.dataset.slot, r: el.getBoundingClientRect(), html: el.outerHTML }));
}
// a card copy appears where the old card lay and slides to `to`
function glide(old, to) {
  const T = window.TABLE;
  if (!T || !old || !to || !T.animOn()) return;
  const g = document.createElement('div'); g.innerHTML = old.html; const c = g.firstElementChild;
  c.classList.remove('deal', 'can'); c.style.cssText = `position:fixed;left:${old.r.left}px;top:${old.r.top}px;width:${old.r.width}px;height:${old.r.height}px;margin:0;z-index:30;pointer-events:none`;
  document.body.appendChild(c);
  T.slide(c, to, { duration: Math.round(420 * fxSp()) }).then(() => c.remove(), () => c.remove());
  c.style.visibility = 'hidden';
}

// sounds + animations for what changed between two snapshots (every mode: computers and online players too)
const monEls = i => [...document.querySelectorAll(`#v-play [data-mon="${i}"].mon, #v-play [data-mon="${i}"].pboard`)].filter(e => e.offsetParent !== null);
function fxReact(prev, s, was) {
  if (!s || !s.pub) return;
  const pub = s.pub, me = s.mySeat;
  let evs = [];
  try { evs = KF.events(prev, pub, me); } catch (e) { evs = []; }
  if (!evs.length) return;
  for (const p of KF.plan(evs, me, fxSp())) { if (p.at > 0) setTimeout(() => FX.play(p.snd, p.o), p.at); else FX.play(p.snd, p.o); }
  const onPlay = ui.tab === 'play';
  const board = onPlay ? $('#v-play .board') : null;
  let big = null;
  for (const x of evs) {
    if (x.e === 'over') {
      // local: a person at this screen won (pass-and-play counts every person); online: this player
      const won = ui.mode === 'local' ? x.winners.some(i => pub.players[i].kind === 'human') : x.mine;
      const colors = x.winners.map(i => MONSTERS[pub.players[i].mon] && MONSTERS[pub.players[i].mon].color).filter(Boolean).concat(['#f0b354', '#f4c542', '#ef5468', '#e8eaf0']);
      setTimeout(() => FX.celebrate(x.winners.length ? { kind: won ? 'win' : 'lose', colors } : { kind: 'lose' }), 700);
      continue;
    }
    if (!onPlay) continue;
    if (x.e === 'dmg') { monEls(x.s).forEach(el => FX.flash(el, 'rgba(239,84,104,.55)')); if (x.n >= 4 && board) FX.shake(board); }
    else if (x.e === 'ko') { monEls(x.s).forEach(el => { FX.flash(el, 'var(--bad)'); FX.shake(el); }); if (board) FX.shake(board); if (pub.cur === me && x.s !== me) big = big || monEls(x.s)[0] || board; }
    else if (x.e === 'enter') { if (board) FX.shake(board); }
    else if (x.e === 'vp' || x.e === 'en') {
      const k = x.e, was = prev && prev.players[x.s] ? prev.players[x.s][k] : null, now = pub.players[x.s][k];
      if (was != null && was < now) monEls(x.s).forEach(el => { const n = el.querySelector(`[data-n="${k}"]`); if (n) FX.countUp(n, was, now, { duration: 500 }); });
      if (k === 'vp' && x.s === me && x.n >= 3) big = monEls(me)[0] || board;
    }
    else if (x.e === 'buy') {
      const o = (was || []).find(w => w.id === x.id), dest = x.s === me ? ($('#v-play .myarea .mine') || monEls(x.s)[0]) : monEls(x.s)[0];
      if (o) glide(o, dest);
      monEls(x.s).forEach(el => FX.pop(el)); if (x.s === me) { const c = [...document.querySelectorAll('#v-play .mine .chipcard[data-card]')].pop(); if (c) FX.pop(c); } }
    else if (x.e === 'sweep') { const dp = $('#dpile'); (was || []).forEach(o => glide(o, dp)); }
    else if (x.e === 'turn' && x.mine) { const b = $('#btn-roll'); if (b) FX.pulse(b); }
    else if (x.e === 'ask') { const b = $('#v-play .acts .btn.primary, #v-play .acts .btn.warm'); if (b) FX.pulse(b); }
  }
  if (big && !evs.some(x => x.e === 'over')) FX.celebrate({ kind: 'big', at: big, colors: ['#f0b354', '#f4c542', '#e8eaf0'] });
}

// act for the seat this screen plays
async function act(a) {
  if (!room || !snap) return;
  recordStudy(a);
  clearTimeout(ui.autoDone);
  if (ui.mode === 'local') {
    // Undo: the table (and the dice stream's place) just before this move
    const g = ui.game, before = g && undoMode() && room.state ? { state: JSON.parse(JSON.stringify(room.state)), rs: ui.rng.get(), study: store.study.length } : null;
    // set before the move: the table redraws (and saves) inside room.act
    const prevUndo = g ? g.undo : null, prevMoved = g ? g.moved : false;
    if (g) { g.moved = true; if (before) g.undo = before; }
    const r = room.act(a, snap.mySeat);
    if (!r.ok) { if (g) { g.undo = prevUndo; g.moved = prevMoved; } FX.play('error'); toast(r.message); }
  } else {
    // one move in flight at a time: a second tap before the room answers is dropped
    if (ui.acting) return;
    ui.acting = true;
    try { const r = await room.act(a); if (!r.ok) { FX.play('error'); toast(r.message); } } finally { ui.acting = false; }
  }
}

// keep a study record of the human's dice decisions (points lost vs the best keep)
function recordStudy(a) {
  try {
    const pub = snap.pub, me = snap.mySeat;
    if (!pub || !pub.ask || pub.ask.type !== 'roll' || pub.t.seat !== me) return;
    if (a.t !== 'reroll' && a.t !== 'done') return;
    if (a.t === 'reroll' && a.use && a.use !== 'normal') return;
    const adv = Bots.advise(pub, me);
    if (!adv || !adv.r) return;
    let chosen;
    if (a.t === 'done') chosen = adv.value(adv.counts);
    else { const kc = D.countsOf(a.keep.map(k => adv.faces[k])); chosen = adv.sv.keepEv(kc, adv.r); }
    store.study.push({ turn: pub.turnNo, faces: adv.faces.join(''), keep: a.t === 'done' ? 'all' : a.keep.join(','), best: adv.keep.join(','), lost: Math.max(0, adv.ev - chosen) });
    if (store.study.length > 200) store.study.splice(0, store.study.length - 200);
  } catch (e) { /* advice is optional */ }
}

// the screen's game view: public view with my seat's secret
function viewState() { return snap && snap.pub; }

function renderPlay() {
  syncEd();
  const v = $('#v-play');
  if (ui.mode === 'online' && snap && snap.status === 'lobby') return renderLobby(v);
  if (ui.mode === 'online' && (!snap || ['joining', 'none', 'closed', 'left'].includes(snap.status))) {
    if (snap && (snap.status === 'closed' || snap.status === 'left')) { ui.mode = null; store.online = false; save(); return renderSetup(v); }
    v.innerHTML = `<div class="setup"><div class="panel"><b>Connecting…</b><span class="muted small">Getting the room.</span><button class="btn" id="btn-cancel">Cancel</button></div></div>`;
    $('#btn-cancel').onclick = () => leaveOnline();
    return;
  }
  if (!room || !snap || !snap.pub) return renderSetup(v);
  renderGame(v);
}

// ------------------------------------------------------------------ setup screen
function renderSetup(v) {
  const st = store.settings;
  const kinds = st.kinds;
  fixMons();
  const seatRows = kinds.map((k, i) => `<div class="seatrow"><button class="icon-btn" style="width:38px;height:36px;border:0;background:none" data-mon-pick="${i}" aria-label="Change monster">${Art.monster(st.mons[i], 32)}</button><span class="nmx">${MONSTERS[st.mons[i]].name} <span class="muted small">· ${k === 'human' ? (i === 0 ? esc(st.name || 'You') : 'Person ' + (i + 1)) : st.level[0].toUpperCase() + st.level.slice(1)}</span></span>
      <button class="btn small kindbtn" data-seat="${i}" ${i === 0 ? 'disabled' : ''}>${k === 'human' ? 'Person' : 'Computer'}</button></div>`).join('');
  v.innerHTML = `<div class="setup">
    <div class="hero"><img src="icon.svg" alt=""><div class="grow"><h1>King of Tokyo Lab</h1><p>Smash Tokyo with exact dice odds.</p></div>${KT && COACH ? '<button class="btn small" id="btn-rules0">Rules</button>' : ''}</div>
    ${PF() ? `<div class="row pf-row"><button class="btn small grow pf-open" id="btn-stats0">${window.Profile.avatarSVG(window.Profile.avatar, 22)}My stats</button><button class="btn small grow" id="btn-daily0">${dailyDone() ? 'Daily ✓' : 'Daily game'}</button></div>` : ''}
    <div class="panel">
      <div class="row"><span class="label grow">Monsters</span>${qTip('Each extra “Person” seat is another player passing this phone. With 5 or 6 monsters, Tokyo Bay opens as a second spot in Tokyo.')}</div>
      <div class="seg" id="seg-n">${[2, 3, 4, 5, 6].map(n => `<button data-n="${n}" aria-pressed="${kinds.length === n}">${n}</button>`).join('')}</div>
      <div class="seats${kinds.length >= 5 ? ' dense' : ''}">${seatRows}</div>
      ${store.saved ? `<div class="row"><button class="btn warm grow" id="btn-resume">Resume game</button><button class="btn" id="btn-new">New game</button></div>`
        : `<button class="btn primary" id="btn-new">Start game</button>`}
    </div>
    <div class="panel">
      <div class="row"><span class="label grow">Play online</span>${qTip('Friends join with the room code on their own phones. Empty seats become computers when you start. Free, no account.')}</div>
      <div class="row"><input class="txt grow" id="in-name" maxlength="20" placeholder="Your name" value="${esc(st.name)}" autocomplete="off"><button class="btn" id="btn-create">Create room</button></div>
      <div class="row"><input class="txt code grow" id="in-code" maxlength="9" placeholder="CODE" autocomplete="off" autocapitalize="characters"><button class="btn" id="btn-join">Join</button></div>
    </div>
  </div>`;
  v.querySelectorAll('#seg-n button').forEach(b => b.onclick = () => {
    const n = +b.dataset.n;
    while (st.kinds.length < n) st.kinds.push('computer');
    st.kinds.length = n; save(); renderSetup(v);
  });
  v.querySelectorAll('[data-mon-pick]').forEach(b => b.onclick = () => {
    const i = +b.dataset.monPick;
    let m = st.mons[i];
    for (let k = 0; k < 6; k++) { m = (m + 1) % 6; if (!st.mons.includes(m)) break; }
    st.mons[i] = m; save(); renderSetup(v);
  });
  v.querySelectorAll('.kindbtn').forEach(b => b.onclick = () => {
    const i = +b.dataset.seat; st.kinds[i] = st.kinds[i] === 'human' ? 'computer' : 'human'; save(); renderSetup(v);
  });
  $('#btn-new').onclick = () => { if (store.saved) recordSaved(store.saved); if (store.saved && store.saved.tut) endTutorial(); store.saved = null; save(); startLocal(null); };
  if ($('#btn-stats0')) $('#btn-stats0').onclick = () => openStats();
  if ($('#btn-daily0')) $('#btn-daily0').onclick = () => startDaily();
  if ($('#btn-resume')) $('#btn-resume').onclick = () => { startLocal(store.saved); if (ui.tut && tour) tour.resume(); };
  if ($('#btn-rules0')) $('#btn-rules0').onclick = () => openRules();
  // first visit: offer the guided first game, once
  if (COACH && tour && !store.saved && !tour.seen() && !COACH.offered(TUT_ID)) {
    COACH.offer({ id: TUT_ID, title: 'New to King of Tokyo?', text: 'Play a guided first game against two computers.', yes: 'Teach me', no: 'No thanks', onYes: startTutorial });
  }
  $('#in-name').oninput = e => { st.name = e.target.value.slice(0, 20); save(); };
  $('#btn-create').onclick = () => createOnlineRoom();
  $('#btn-join').onclick = () => joinOnlineRoom($('#in-code').value);
}

// ------------------------------------------------------------------ online
async function loadOnline() {
  if (net.room) return net.room;
  const mod = await import('./online.js?v=1');
  if (net.room) return net.room;
  net.room = mod.createOnline({ game: GAME, gameId: 'king-of-tokyo', botDelayMs: 900 });
  net.room.on('change', s => { if (ui.mode !== 'online') return; onSnap(s); });
  net.room.on('error', msg => { toast(String(msg)); if (ui.tab === 'play') renderPlay(); });
  return net.room;
}
function needName() {
  const n = (store.settings.name || '').trim();
  if (!n) { toast('Type your name first.'); const el = $('#in-name'); if (el) el.focus(); return null; }
  return n;
}
async function createOnlineRoom() {
  const name = needName(); if (!name) return;
  closeRoom(); ui.mode = 'online'; snap = { status: 'joining' }; renderPlay();
  try {
    const r0 = await loadOnline();
    room = r0;
    const kinds = store.settings.kinds;
    const seats = kinds.map((k, i) => (i === 0 ? 'human' : k === 'computer' ? 'computer' : 'empty'));
    fixMons();
    const r = await r0.createRoom({ name, seats, options: { edition: store.settings.edition, level: store.settings.level, bay: store.settings.bay, duel: store.settings.duel, monsters: store.settings.mons } });
    if (!r.ok) { toast(r.message); ui.mode = null; room = null; snap = null; renderPlay(); return; }
    store.online = true; save();
  } catch (e) { toast('Online play couldn’t load. Check your internet.'); ui.mode = null; room = null; snap = null; renderPlay(); }
}
async function joinOnlineRoom(code) {
  const name = needName(); if (!name) return;
  code = String(code || '').replace(/\s+/g, '').toUpperCase();
  if (code.length !== 5) { toast('Room codes have 5 characters.'); return; }
  closeRoom(); ui.mode = 'online'; snap = { status: 'joining' }; renderPlay();
  try {
    const r0 = await loadOnline();
    room = r0;
    const r = await r0.joinRoom(code, name);
    if (!r.ok) { toast(r.message); ui.mode = null; room = null; snap = null; renderPlay(); return; }
    store.online = true; save();
  } catch (e) { toast('Online play couldn’t load. Check your internet.'); ui.mode = null; room = null; snap = null; renderPlay(); }
}
async function leaveOnline() {
  const r = net.room;
  ui.mode = null; room = null; snap = null; store.online = false; save();
  renderPlay();
  if (r) { try { if (r.isHost && snap && snap.status === 'finished') await r.close(); else await r.leave(); } catch (e) { /* ignore */ } }
}

function renderLobby(v) {
  const s = snap;
  // each seat's picked monster, the same way the engine assigns them at the start
  const picks = (s.options && s.options.monsters) || [], used = new Set();
  const mons = s.seats.map((x, i) => (Number.isInteger(picks[i]) && picks[i] >= 0 && picks[i] < 6 ? picks[i] : i));
  for (let i = 0; i < mons.length; i++) { if (used.has(mons[i])) mons[i] = [0, 1, 2, 3, 4, 5].find(m => !used.has(m)); used.add(mons[i]); }
  const rows = s.seats.map((x, i) => {
    const label = x.kind === 'human' ? esc(x.name || 'Player') + (i === s.mySeat ? ' (you)' : '') + (x.isHost ? ' · host' : '') : x.kind === 'computer' ? 'Computer' : '<span class="muted">Open seat</span>';
    const ctrl = s.isHost && x.kind !== 'human' ? `<button class="btn small" data-seat="${i}" data-to="${x.kind === 'computer' ? 'empty' : 'computer'}">${x.kind === 'computer' ? 'Open it' : 'Computer'}</button>` : '';
    return `<div class="seatrow">${Art.monster(mons[i], 30)}<span class="nmx">${label}</span>${ctrl}</div>`;
  }).join('');
  v.innerHTML = `<div class="setup">
    <div class="panel" style="align-items:center;text-align:center">
      <span class="label">Room code</span><div class="code-big">${esc(s.code || '')}</div>
      <span class="muted small">Friends: open this site, type the code, tap Join.</span>
    </div>
    <div class="panel"><div class="seats">${rows}</div>
      ${s.isHost ? '<button class="btn primary" id="btn-start">Start game</button>' : '<span class="muted small">Waiting for the host to start…</span>'}
      <button class="btn ghost" id="btn-leave">Leave room</button></div>
  </div>`;
  v.querySelectorAll('button[data-seat]').forEach(b => b.onclick = () => room.setSeat(+b.dataset.seat, b.dataset.to));
  if ($('#btn-start')) $('#btn-start').onclick = async e => {
    const b = e.currentTarget; if (b.disabled) return; b.disabled = true;
    const r = await room.start(); if (!r.ok) { toast(r.message); b.disabled = false; }
  };
  $('#btn-leave').onclick = () => leaveOnline();
}

// ------------------------------------------------------------------ the game table
function myAsk() {
  const p = snap.pub;
  if (!p || !p.ask || p.over) return null;
  return snap.toAct.includes(snap.mySeat) ? p.ask.type : null;
}
function playerFace(p, i) { return p.alive ? Art.monster(p.mon, 30) : Art.monster(p.mon, 30, 'style="filter:grayscale(1)"'); }

// the odds + log side panel shows only on wide laptops; below that the table takes the width
// (the log is behind its button, as on the phone). Crossing the line redraws the table.
const SIDE = window.matchMedia('(min-width: 1700px)');
const onSide = () => { if (ui.tab === 'play' && snap && snap.pub) { ui.secHtml = null; renderPlay(); } };
if (SIDE.addEventListener) SIDE.addEventListener('change', onSide); else if (SIDE.addListener) SIDE.addListener(onSide);
function renderGame(v) {
  window.__kotRenders = (window.__kotRenders || 0) + 1;
  const pub = snap.pub, me = snap.mySeat, t = pub.t;
  const ask = myAsk();
  const P = pub.players;
  // a new roll: kept dice from the engine become the starting keep selection
  const rollKey = t ? pub.turnNo + ':' + t.rollId : null;
  const newRoll = rollKey !== ui.lastRoll;
  if (newRoll) {
    // after a reload, the dice you had raised for this same roll come back
    const ks = store.keepSel;
    if (ks && ks.key === rollKey && Array.isArray(ks.keep) && t) ui.keep = new Set(ks.keep.filter(k => Number.isInteger(k) && k >= 0 && k < t.dice.length));
    else ui.keep = new Set(t ? t.dice.map((d, k) => (d.k ? k : -1)).filter(k => k >= 0) : []);
    ui.change = null;
  }
  const rolledNow = newRoll && t ? new Set(t.rolledIdx) : new Set();
  ui.lastRoll = rollKey;

  // ---- seats: each monster's board (portrait, heart dial, star dial), its energy cubes and its keep cards,
  // laid out like the real table: the others across the far side, yours at the bottom edge
  const seat = i => {
    const p = P[i], cls = ['mon', 'seat'];
    if (i === me) cls.push('me');
    if (pub.cur === i && !pub.over) cls.push('turn');
    if (pub.tokyo.city === i) cls.push('tokyo');
    if (pub.tokyo.bay === i) cls.push('tokyo', 'bay');
    if (!p.alive) cls.push('out');
    if (pub.ask && pub.ask.waiting.includes(i) && pub.cur !== i) cls.push('wait');
    const col = MONSTERS[p.mon] ? MONSTERS[p.mon].color : '#888';
    const toks = (p.poison ? `<span class="tok poison" title="Poison">☠${p.poison > 1 ? p.poison : ''}</span>` : '') + (p.shrink ? `<span class="tok shrink" title="Shrink">↓${p.shrink > 1 ? p.shrink : ''}</span>` : '');
    const where = pub.tokyo.city === i ? '<span class="where">CITY</span>' : pub.tokyo.bay === i ? '<span class="where bay">BAY</span>' : '';
    // phone: a tiny face-up fan in the board's corner (one little card per keep card, tinted by kind); laptop: readable mini cards
    // five rivals across a phone leave each board narrow: a smaller fan plus the count, so the name stays readable
    const fanMax = P.length - (P[me] ? 1 : 0) >= 5 ? 2 : 6;
    const fan = p.cards.slice(0, fanMax).map(c => `<i class="k${Art.cardKind(c.id)}"></i>`).join('');
    const cards = i === me ? '' : `<span class="scards">${p.cards.map(c => miniCard(c, 'opp')).join('')}</span>${p.cards.length ? `<span class="ncards" aria-label="${p.cards.length} cards">${fan}${p.cards.length > fanMax ? `<b>${p.cards.length}</b>` : ''}</span>` : ''}`;
    return `<div class="${cls.join(' ')}" data-mon="${i}" style="--mc:${col};--n:${Math.max(1, p.cards.length)}">
      <div class="mboard">${where}<span class="av">${playerFace(p, i)}</span><span class="nmx">${esc(i === me ? (p.name === 'You' ? 'You' : p.name) : p.name)}</span>
        <span class="dial hp">${Art.icon('H', 12)}<b data-n="hp">${p.hp}</b></span><span class="dial vp">${Art.icon('VP', 12)}<b data-n="vp">${p.vp}</b></span></div>
      <span class="cubes"><i class="cube"></i>${p.en > 1 ? '<i class="cube c2"></i>' : ''}${p.en > 4 ? '<i class="cube c3"></i>' : ''}<b data-n="en">${p.en}</b></span>${toks}${cards}</div>`;
  };
  const opps = P.map((p, i) => i).filter(i => i !== me).map(seat).join('');

  // ---- Tokyo board: printed city, a standee on each occupied spot
  // the standee stomps in only when a monster enters (not on every redraw); its numbers live on its own board
  const seenTk = ui.tokyoSeen || {};
  const spot = (which) => {
    const i = pub.tokyo[which];
    const enter = seenTk[which] !== undefined && seenTk[which] !== i ? ' enter' : '';
    const occ = i >= 0 ? `<div class="occ${enter}" data-mon="${i}"><span class="standee">${Art.monster(P[i].mon, 58)}</span><div class="plate"><b>${esc(i === me ? 'You' : P[i].name)}</b></div></div>` : `<div class="empty">Empty</div>`;
    return `<div class="spot ${which}"><span class="tag">TOKYO ${which === 'city' ? 'CITY' : 'BAY'}</span>${occ}</div>`;
  };
  // the board keeps its real 2:1 shape, as big as its space allows (the wrapper measures the space)
  const board = `<div class="bwrap"><div class="board">${Art.boardArt()}${spot('city')}${pub.bayRule && (pub.bayOpen || pub.tokyo.bay >= 0) ? spot('bay') : ''}</div></div>`;
  ui.tokyoSeen = { city: pub.tokyo.city, bay: pub.tokyo.bay };

  // ---- status line
  let who = '', sub = '';
  const curP = pub.cur >= 0 ? P[pub.cur] : null;
  const nm = i => (i === me ? 'You' : esc(P[i].name));
  if (pub.over) {
    who = pub.winners.length ? pub.winners.map(nm).join(' & ') + (pub.winners.includes(me) ? ' win!' : ' wins!') : 'Nobody wins';
    sub = pub.why === 'points' ? 'reached 20 points' : pub.why === 'last' ? 'last monster standing' : '';
  } else if (ask) {
    const tt = { start: 'Your turn', roll: 'Keep dice, then reroll', probe: 'Psychic Probe', ray: 'Healing Ray', wings: 'Wings?', yield: 'Stay in Tokyo?', mimic: 'Mimic', opp: 'Opportunist', buy: 'Buy cards' };
    who = tt[ask] || 'Your move';
    if (ask === 'roll') sub = t.rerolls > 0 ? t.rerolls + ' reroll' + (t.rerolls > 1 ? 's' : '') + ' left' : 'no rerolls left';
    else if (ask === 'buy') sub = 'You have ' + P[me].en + ' energy';
    else if (ask === 'probe') sub = 'tap one of ' + nm(pub.cur) + '’s dice, or skip';
    else if (ask === 'yield') sub = 'you took a hit';
    else if (ask === 'wings') sub = pub.ask.dmg + ' damage coming';
  } else if (curP) {
    const w = pub.ask ? pub.ask.waiting : [];
    const waitOn = w.length && w[0] !== pub.cur ? w[0] : pub.cur;
    const doing = { start: 'is about to roll', roll: 'is rolling', probe: 'is using Psychic Probe', ray: 'is healing', wings: 'is deciding on Wings', yield: 'is deciding to stay or leave', mimic: 'is choosing a card to copy', opp: 'is thinking (Opportunist)', buy: 'is shopping' };
    who = nm(waitOn); sub = doing[pub.ask ? pub.ask.type : 'roll'] || '';
    if (snap.seats && snap.seats[waitOn] && snap.seats[waitOn].kind === 'human' && snap.mode === 'online' && !snap.seats[waitOn].online) sub += ' (offline)';
  }
  if (snap.hostAway) sub = 'Host lost connection; waiting…';

  // ---- dice
  let dice = '';
  if (t && t.dice.length && pub.cur >= 0) {
    const adv = ask === 'roll' && store.settings.hints ? safeAdvise(pub, me) : null;
    const hint = adv ? new Set(adv.keep) : new Set();
    dice = t.dice.map((d, k) => {
      const cls = ['die'];
      const mine = ask === 'roll';
      if (mine ? ui.keep.has(k) : d.k) cls.push('kept');
      if (hint.has(k)) cls.push('hint');
      if (rolledNow.has(k)) cls.push('roll');
      if (ask === 'probe' || ui.change) cls.push('pick');
      // each die lands at its own slight angle, like dice thrown on a table (fixed per roll so it doesn't wobble on redraws)
      const tilt = ((k * 7 + (t.rollId || 0) * 5 + pub.turnNo * 3) % 11) - 5;
      return `<button class="${cls.join(' ')}" data-die="${k}" style="--tilt:${tilt}deg;animation-delay:${rolledNow.has(k) ? Math.round(k * 40 * fxSp()) : 0}ms" aria-label="${d.f}">${Art.face(d.f, 24, DIE_INK)}</button>`;
    }).join('');
  } else if (curP) {
    const n = 6;
    dice = Array.from({ length: n }, () => `<span class="die ghost">${Art.face('1', 24, DIE_INK)}</span>`).join('');
  }

  // ---- odds bar
  const odds = oddsBar(pub, me, ask);

  // ---- my keep cards, laid face up in front of me
  const myP = P[me];
  const abil = abilities(pub, me, ask);
  // the ability buttons sit after the cards row, never scrolled off the screen by a long row
  const mine = (myP ? myP.cards.map(c => miniCard(c, abil.ids.has(c.id) ? 'ab' : '')).join('') : '')
    + (snap.mine && snap.mine.top && ask === 'buy' ? `<span class="chipcard mini ab top" data-top="1"><span class="nm">Top: ${esc(CARDS[snap.mine.top].name)}</span></span>` : '');
  const nMine = (myP ? myP.cards.length : 0) + (snap.mine && snap.mine.top && ask === 'buy' ? 1 : 0);

  // ---- market: draw deck, three face-up cards, discard pile
  const canBuy = ask === 'buy' || ask === 'opp';
  const market = `<div class="mcol"><div class="deck" id="deck" aria-label="${pub.deckSize} cards in the deck"></div><button class="sweep" id="btn-sweep" ${ask === 'buy' && myP && myP.en >= 2 ? '' : 'disabled'}>${Art.icon('E', 13)}<b>2</b><span>Sweep</span></button></div>`
    + pub.market.map((id, k) => {
      if (!id) return '<div class="slot tbl-spot"></div>';
      const cost = myP ? E.costFor(pub, me, id) : CARDS[id].cost;
      const fresh = ui.marketSeen[k] !== id;
      const cls = ['pc', CARDS[id].keep ? 'K' : 'D'];
      if (fresh) cls.push('deal');
      if (canBuy && myP && myP.en >= cost && (ask === 'buy' || pub.ask.i === k)) cls.push('can');
      return cardFace(id, cls.join(' '), cost, `data-slot="${k}" data-id="${id}"`);
    }).join('') + `<div class="mcol"><div class="dpile" id="dpile" aria-label="${pub.discardSize} cards in the discard pile"></div></div>`;
  const dealt = pub.market.map((id, k) => (id && ui.marketSeen[k] !== id && ui.marketSeen.length ? k : -1)).filter(k => k >= 0);
  ui.marketSeen = pub.market.slice();

  // ---- actions
  const acts = actionButtons(pub, me, ask);

  // ---- log
  const logHtml = logList(pub, me, 40);

  // only the parts of the table that changed are drawn again (a full redraw repainted the whole wooden
  // table on every tap: about 4x slower than before the table look in Safari's engine, measured)
  const wide = SIDE.matches;
  // wide laptop: the odds strip sits in the side panel above the log, off the table
  const html = `<div class="opps${P.length - (P[me] ? 1 : 0) >= 5 ? ' many' : ''}">${opps}</div>
    ${board}
    <div class="market" id="market" data-pile="${esc(discardFaces(pub).length + ':' + (pub.discardTop || ui.discards || []).join(','))}">${market}</div>
    <div class="status"><div class="grow" style="min-width:0"><div class="who">${who}</div></div><span class="sub">${sub}</span>
      ${undoMode() ? `<button class="icon-btn" id="btn-undo" aria-label="Undo your last move" title="Undo" ${canUndo() ? '' : 'disabled'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button>` : ''}
      <button class="icon-btn" id="btn-log" aria-label="Game log"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg></button>
      <button class="icon-btn" id="btn-menu" aria-label="Game menu"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div>
    <div class="dice">${dice}</div>
    ${wide ? '' : odds}
    <div class="myarea">${myP ? seat(me) : ''}<div class="mine" style="--n:${Math.max(1, nMine)}">${mine || '<span class="nocards sr-only">No cards yet</span>'}</div>${abil.html ? `<div class="abil">${abil.html}</div>` : ''}</div>
    <div class="acts">${acts}</div>
    <div id="g-side">${wide ? odds : ''}<div class="panel logbox"><span class="label">Log</span><div class="scroll" style="flex:1"><ul class="log">${logHtml}</ul></div></div></div>`;
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const news = [...tpl.content.children], newHtml = news.map(n => n.outerHTML);
  let g = $('#game', v);
  const olds = g ? [...g.children] : [];
  const same = g && ui.secHtml && olds.length === news.length && ui.secHtml.length === news.length;
  if (!same) {
    v.innerHTML = '<div id="game" class="tbl-surface tbl-wood-dark"></div>';
    g = $('#game', v); news.forEach(n => g.appendChild(n));
  } else news.forEach((n, k) => { if (newHtml[k] !== ui.secHtml[k]) olds[k].replaceWith(n); });
  const marketNew = !same || newHtml[2] !== ui.secHtml[2];
  ui.secHtml = newHtml;
  // the deck is a real stack (thinner as it's drawn), the discard pile a loose face-up heap
  const T = window.TABLE;
  if (T && marketNew) {
    T.deck($('#deck', v), pub.deckSize, { pattern: 'sunburst', cls: 'kback', badge: true, perCard: 0.2, max: 10 });
    T.pile($('#dpile', v), discardFaces(pub), { seed: 'kot-discard', max: 4, rot: 12, off: 3 });
  }
  if (wide) { const sc = $('#g-side .logbox .scroll', v); if (sc) sc.scrollTop = sc.scrollHeight; }
  // a row squeezed so its cards overlap shows each name from its left edge (the part still in view)
  v.querySelectorAll('.mine, .seat .scards').forEach(row => {
    const c = row.querySelectorAll('.chipcard');
    row.classList.toggle('tight', c.length > 1 && c[1].getBoundingClientRect().left - c[0].getBoundingClientRect().left < c[0].getBoundingClientRect().width - 14);
  });
  wireGame(v, pub, me, ask);
  markDrawn();
  floats(pub);
  dealIn(dealt);
  if (pub.over && !ui.endShown) { ui.endShown = true; setTimeout(() => showEnd(), 700); }
  // nothing left to do with the dice: resolve on its own
  // (one timer only: every redraw, like tapping a die, used to start another one and the second 'done' failed)
  clearTimeout(ui.autoDone);
  if (ask === 'roll' && !t.opts.length && !abil.change) ui.autoDone = setTimeout(() => { if (myAsk() === 'roll' && ui.lastRoll === rollKey) act({ t: 'done' }); }, 650);
  // decisions that need a sheet
  if (ask === 'ray' && ui.sheetKind !== 'ray') raySheet(pub, me);
  if (ask === 'mimic' && ui.sheetKind !== 'mimic') mimicSheet(pub, me, true);
  if (ui.tut && tour && tour.active) tour.update();
}

function safeAdvise(pub, me) { try { return Bots.advise(pub, me); } catch (e) { return null; } }

// a power card laid out like the real ones: cost top-left, name banner, picture, KEEP/DISCARD, rules text
function cardFace(id, cls, cost, attrs, tag) {
  const c = CARDS[id];
  const kind = Art.cardKind(id);
  tag = tag || 'button';
  return `<${tag} class="${cls}" ${attrs || ''}><span class="cst">${Art.icon('E', 14)}<b>${cost == null ? c.cost : cost}</b></span><span class="nm${c.name.length > 16 ? ' long' : ''}">${esc(c.name)}</span>
    <span class="art k${kind}">${Art.cardIcon(id, 40)}</span><span class="ty">${c.keep ? 'KEEP' : 'DISCARD'}</span><span class="tx">${esc(c.text)}</span></${tag}>`;
}
// a small keep card on the table in front of its owner (tap for the full card)
function miniCard(c, extra) {
  const d = CARDS[c.id];
  return `<span class="chipcard mini${extra ? ' ' + extra : ''}" data-card="${c.id}" data-k="${c.k}" title="${esc(d.name)}"><span class="nm">${esc(d.name)}</span><span class="art k${Art.cardKind(c.id)}">${Art.cardIcon(c.id, 18)}</span>${c.as ? `<span class="as">${esc(CARDS[c.as].name)}</span>` : ''}${c.c != null ? `<span class="ctr">${c.c}</span>` : ''}</span>`;
}
// the discard pile: the cards this screen saw go there (the room shares only the count)
function discardFaces(pub) {
  const n = pub.discardSize || 0;
  if (!n) { ui.discards = []; return []; }
  // the pile is face up and public: the view carries its top cards (older rooms: what this screen saw)
  const known = (Array.isArray(pub.discardTop) ? pub.discardTop : ui.discards || []).filter(id => CARDS[id]).slice(-Math.min(4, n));
  const out = [];
  for (let k = known.length; k < Math.min(4, n); k++) out.push('<span class="tbl-card pc used"></span>');
  return out.concat(known.map(id => cardFace(id, 'tbl-card pc pile ' + (CARDS[id].keep ? 'K' : 'D'), null, '', 'span')));
}
// cards that left the market or a monster's row and are nowhere now went to the discard pile
function trackDiscards(prev, pub) {
  if (!prev || !pub || !prev.market || !pub.market) return;
  if (pub.discardSize < (prev.discardSize || 0)) ui.discards = [];
  const count = arr => arr.reduce((m, id) => { if (id) m[id] = (m[id] || 0) + 1; return m; }, {});
  const before = count(prev.market.concat(...prev.players.map(p => p.cards.map(c => c.id))));
  const now = count(pub.market.concat(...pub.players.map(p => p.cards.map(c => c.id))));
  const gone = [];
  for (const id of Object.keys(before)) for (let k = (now[id] || 0); k < before[id]; k++) gone.push(id);
  if (gone.length && pub.discardSize > (prev.discardSize || 0)) ui.discards = (ui.discards || []).concat(gone).slice(-8);
}
// a new market card flies off the deck and turns face up in its slot
function dealIn(slots) {
  const T = window.TABLE, dk = $('#deck');
  if (!T || !dk || !slots.length) return;
  slots.forEach((k, j) => { const to = document.querySelector(`#market [data-slot="${k}"]`); if (to) setTimeout(() => T.deal(dk, to, { cls: 'kback', duration: Math.round(320 * fxSp()) }), j * 90); });
}

function abilities(pub, me, ask) {
  const ids = new Set();
  let html = '';
  let change = false;
  const p = pub.players[me];
  if (!p || !p.alive) return { ids, html, change };
  const t = pub.t;
  if (ask === 'roll') {
    if (E.has(pub, me, 'herd-culler') && !t.herd) { ids.add('herd-culler'); change = true; html += `<button class="btn small" data-chg="herd">Make a 1</button>`; }
    if (E.has(pub, me, 'stretchy') && p.en >= 2) { ids.add('stretchy'); change = true; html += `<button class="btn small" data-chg="stretchy">Stretchy 2⚡</button>`; }
    if (E.insts(pub, me, 'plot-twist').length) { ids.add('plot-twist'); change = true; html += `<button class="btn small" data-chg="plot">Plot Twist</button>`; }
    if (t.rerolls === 0) for (const u of t.opts) {
      const lbl = { smoke: 'Smoke reroll', telepath: CARDS.telepath.name + ' 1⚡', dweller: 'Reroll 3s' }[u];
      if (lbl) { html += `<button class="btn small" data-use="${u}">${lbl}</button>`; }
    }
  }
  if ((ask === 'start' || ask === 'roll' || ask === 'buy') && E.has(pub, me, 'rapid-healing') && p.en >= 2 && p.hp < p.maxHp) { ids.add('rapid-healing'); html += `<button class="btn small" data-rapid="1">Heal 2⚡</button>`; }
  if (ask === 'start' && p.cards.some(c => c.id === 'mimic') && p.en >= 1 && E.mimicTargets(pub, me).length) { ids.add('mimic'); html += `<button class="btn small" data-mimic="1">Switch Mimic 1⚡</button>`; }
  return { ids, html, change };
}

function actionButtons(pub, me, ask) {
  const t = pub.t, p = pub.players[me];
  if (pub.over) return `<button class="btn primary" id="btn-again">New game</button><button class="btn" id="btn-results">Results</button>${ui.game && ui.game.tl.length > 1 ? '<button class="btn" id="btn-review">Review</button>' : ''}`;
  switch (ask) {
    case 'start': return `<button class="btn primary" id="btn-roll">Roll ${t && t.less ? (6 - t.less) : ''} dice</button>`;
    case 'roll': {
      const re = t.dice.length - ui.keep.size;
      const lbl = t.rerolls > 0 ? `Reroll ${re || ''} <span class="muted" style="font-weight:500">· ${t.rerolls} left</span>` : 'Reroll';
      const can = re > 0 && t.rerolls > 0;
      return `<button class="btn primary" id="btn-reroll" ${can ? '' : 'disabled'}>${lbl}</button><button class="btn" id="btn-done">Done</button>`;
    }
    case 'probe': return `<button class="btn" id="btn-pass">Skip</button>`;
    case 'wings': return `<button class="btn warm" id="btn-wings">Use Wings · 2⚡</button><button class="btn" id="btn-nowings">Take it</button>`;
    case 'yield': {
      const ko = safeKo(pub, me, p.hp);
      return `<button class="btn primary" id="btn-stay">Stay${ko != null ? ` <span style="font-weight:500">· ${pct(ko)} risk</span>` : ''}</button><button class="btn" id="btn-leave">Leave</button>`;
    }
    case 'opp': { const id = pub.market[pub.ask.i]; return `<button class="btn primary" id="btn-opp">Buy ${esc(CARDS[id].name)}</button><button class="btn" id="btn-pass">Pass</button>`; }
    case 'buy': return `<button class="btn primary" id="btn-end">End turn</button>`;
    case 'ray': return `<button class="btn primary" id="btn-ray">Healing Ray…</button>`;
    case 'mimic': return `<button class="btn primary" id="btn-mimicpick">Pick a card to copy…</button>`;
  }
  if (p && !p.alive) return `<button class="btn" disabled>You’re knocked out · watching</button>`;
  return `<button class="btn" disabled>${pub.cur === me ? 'Working…' : 'Waiting…'}</button>`;
}
function safeKo(pub, me, hp) { try { return Bots.koChance(pub, me, hp); } catch (e) { return null; } }

function oddsBar(pub, me, ask) {
  const p = pub.players[me];
  if (!p) return '<div class="odds"></div>';
  if (ask === 'roll') {
    const adv = safeAdvise(pub, me);
    if (!adv) return '<div class="odds"></div>';
    const keepC = D.countsOf([...ui.keep].map(k => adv.faces[k]));
    const yours = adv.r ? adv.sv.keepEv(keepC, adv.r) : adv.value(adv.counts);
    const lost = Math.max(0, adv.ev - yours);
    return `<div class="odds" id="odds"><div class="cells"><span>Best <b>${fmt1(adv.ev)}</b> pts</span><span>Yours <b style="color:${scale(1 - lost / 2)}">${lost < 0.05 ? 'best' : '−' + fmt1(lost)}</b></span>${store.settings.hints ? '<span class="muted">● = best keep</span>' : ''}</div>${qTip('Points = expected stars from the dice, plus energy, hearts and claws counted by how much they help you right now. “Yours” is what your current keep gives up versus the best keep. Tap the bar for set and claw chances.')}</div>`;
  }
  if (ask === 'yield' || (E.inTokyo(pub, me) && p.alive)) {
    const ko = safeKo(pub, me, p.hp);
    if (ko == null) return '<div class="odds"></div>';
    // what staying is worth: the start-of-turn Tokyo points, if you live to collect them
    const gain = pub.duel ? 0 : 2 + E.has(pub, me, 'urbavore');
    const ev = ask === 'yield' && gain ? `<span>Stay ≈ <b>+${fmt1((1 - ko) * gain)}</b> ★</span>` : '';
    return `<div class="odds" id="odds"><div class="cells"><span>Knock-out risk before your turn <b style="color:${scale(1 - ko / 0.5)}">${pct(ko)}</b></span>${ev}</div>${qTip('If you stay in Tokyo, every monster outside rolls at you once before your next turn. Assumes each of their dice ends as a claw ' + Math.round(Bots.CFG.claw * 100) + '% of the time (measured from computer games). Stay ≈ the ' + gain + ' points for starting your turn in Tokyo times your chance to survive until then. The Hard computer leaves above ' + Math.round(Bots.CFG.stayKo * 100) + '% risk.')}</div>`;
  }
  const lead = Math.max(...pub.players.map(x => x.vp));
  return `<div class="odds" id="odds"><div class="cells"><span>Deck <b>${pub.deckSize}</b></span><span>Leader <b>${lead}</b>/20</span><span>Turn <b>${pub.turnNo}</b></span></div></div>`;
}

function logList(pub, me, n) {
  return pub.log.slice(-n).map(l => `<li class="${l.s === me ? 'me' : ''}">${l.s >= 0 && !l.m.startsWith(pub.players[l.s].name + ' ') ? '<b>' + esc(l.s === me ? 'You' : pub.players[l.s].name) + '</b> ' : ''}${esc(l.m)}</li>`).join('');
}

function floats(pub) {
  const key = pub.turnNo + '|' + pub.log.length + '|' + JSON.stringify(pub.fx);
  if (key === ui.fxKey || !pub.fx.length) { ui.fxKey = key; return; }
  ui.fxKey = key;
  if (!FX.settings.animations) return;
  const sum = {};
  for (const f of pub.fx) {
    if (!['hp', 'vp', 'en'].includes(f.k)) continue;
    const k = f.s + f.k; sum[k] = sum[k] || { s: f.s, k: f.k, n: 0 }; sum[k].n += f.n;
  }
  const col = { hp: 'var(--hp)', vp: 'var(--vp)', en: 'var(--en)' };
  const sym = { hp: '♥', vp: '★', en: '⚡' };
  let off = 0;
  for (const x of Object.values(sum)) {
    if (!x.n) continue;
    document.querySelectorAll(`[data-mon="${x.s}"].mon, [data-mon="${x.s}"].pboard`).forEach(el => {
      const f = document.createElement('span'); f.className = 'float';
      f.style.color = col[x.k]; f.style.animationDelay = (off * 120) + 'ms'; f.style.marginTop = (off * 2) + 'px';
      f.textContent = (x.n > 0 ? '+' : '') + x.n + sym[x.k];
      el.appendChild(f); setTimeout(() => f.remove(), 1500);
      if (x.k === 'hp' && x.n < 0) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
    });
    off++;
  }
}

function wireGame(v, pub, me, ask) {
  const on = (sel, fn) => { const el = $(sel, v); if (el) el.onclick = fn; };
  on('#btn-roll', () => act({ t: 'roll' }));
  on('#btn-reroll', () => act({ t: 'reroll', keep: [...ui.keep].sort((a, b) => a - b), use: 'normal' }));
  on('#btn-done', () => act({ t: 'done' }));
  on('#btn-pass', () => act({ t: 'pass' }));
  on('#btn-wings', () => act({ t: 'wings', use: true }));
  on('#btn-nowings', () => act({ t: 'wings', use: false }));
  on('#btn-stay', () => act({ t: 'yield', leave: false }));
  on('#btn-leave', () => act({ t: 'yield', leave: true }));
  on('#btn-opp', () => act({ t: 'buy' }));
  on('#btn-end', () => endTurn(pub, me));
  on('#btn-ray', () => raySheet(pub, me));
  on('#btn-mimicpick', () => mimicSheet(pub, me, true));
  on('#btn-sweep', () => act({ t: 'sweep' }));
  on('#btn-log', () => openSheet(`<h3>Game log</h3><div class="scroll" id="logscroll"><ul class="log">${logList(pub, me, 80)}</ul></div><button class="btn" onclick="document.getElementById('sheet').remove()">Close</button>`, el => { const s = $('#logscroll', el); s.scrollTop = s.scrollHeight; }));
  on('#btn-menu', () => gameMenu());
  on('#btn-undo', () => undo());
  on('#btn-review', () => reviewSheet());
  on('#btn-again', () => newGameFromEnd());
  on('#btn-results', () => showEnd());
  on('#odds', e => { if (!e.target.closest('.q')) oddsSheet(pub, me, ask); });
  v.querySelectorAll('[data-die]').forEach(b => b.onclick = () => {
    const k = +b.dataset.die;
    if (ask === 'probe') { act({ t: 'probe', i: k }); return; }
    if (ask !== 'roll') return;
    if (ui.change) { facePicker(k, ui.change); return; }
    if (ui.keep.has(k)) { ui.keep.delete(k); FX.play('place', { pitch: 1.3, vol: 0.5 }); } else { ui.keep.add(k); FX.play('place', { pitch: 1.7, vol: 0.6 }); }
    store.keepSel = { key: ui.lastRoll, keep: [...ui.keep] }; save();
    renderPlay();
  });
  v.querySelectorAll('[data-chg]').forEach(b => b.onclick = () => { ui.change = b.dataset.chg; toast('Tap the die to change'); renderPlay(); });
  v.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
    const keep = [...ui.keep].sort((a, c) => a - c);
    if (b.dataset.use === 'dweller') { const k3 = pub.t.dice.map((d, k) => (d.f === '3' && !ui.keep.has(k) ? -1 : k)).filter(k => k >= 0); act({ t: 'reroll', keep: k3, use: 'dweller' }); return; }
    act({ t: 'reroll', keep, use: b.dataset.use });
  });
  v.querySelectorAll('[data-rapid]').forEach(b => b.onclick = () => act({ t: 'rapid' }));
  v.querySelectorAll('[data-mimic]').forEach(b => b.onclick = () => mimicSheet(pub, me, false));
  v.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => cardSheet(pub.market[+b.dataset.slot], { slot: +b.dataset.slot }));
  v.querySelectorAll('[data-top]').forEach(b => b.onclick = () => cardSheet(snap.mine.top, { top: true }));
  // a card squeezed to a thin strip in a long row is hard to hit: tapping it opens the owner's full card list instead
  v.querySelectorAll('[data-card]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const nx = b.nextElementSibling && b.nextElementSibling.matches('.chipcard') ? b.nextElementSibling : null;
    const strip = nx ? nx.getBoundingClientRect().left - b.getBoundingClientRect().left : 99;
    const owner = b.closest('[data-mon]') ? +b.closest('[data-mon]').dataset.mon : b.closest('.mine') ? me : -1;
    if (strip < 30 && owner >= 0 && pub.players[owner]) { monsterSheet(owner); return; }
    cardSheet(b.dataset.card, { k: +b.dataset.k });
  });
  v.querySelectorAll('[data-mon]').forEach(b => b.onclick = () => monsterSheet(+b.dataset.mon));
}

function facePicker(k, via) {
  const faces = via === 'herd' ? ['1'] : D.FACES;
  openSheet(`<h3>Change this die to…</h3><div class="facepick">${faces.map(f => `<button class="die" data-f="${f}">${Art.face(f, 24, DIE_INK)}</button>`).join('')}</div>
    <button class="btn" id="btn-x">Cancel</button>`, el => {
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { closeSheet(); ui.change = null; act({ t: 'change', i: k, f: b.dataset.f, via }); });
    $('#btn-x', el).onclick = () => { closeSheet(); ui.change = null; renderPlay(); };
  });
}

function endTurn(pub, me) {
  const p = pub.players[me];
  if (E.has(pub, me, 'metamorph') && p.cards.some(c => CARDS[c.id].keep)) {
    const sel = new Set();
    openSheet(`<h3>Metamorph</h3><span class="muted small">Discard keep cards to get back what they cost.</span>
      <div class="seats">${p.cards.map(c => `<label class="seatrow"><input type="checkbox" data-k="${c.k}"><span class="nmx">${esc(CARDS[c.id].name)}</span>${costTag(CARDS[c.id].cost)}</label>`).join('')}</div>
      <button class="btn primary" id="btn-endm">End turn</button>`, el => {
      el.querySelectorAll('input[data-k]').forEach(i => i.onchange = () => { const k = +i.dataset.k; if (i.checked) sel.add(k); else sel.delete(k); });
      $('#btn-endm', el).onclick = () => { closeSheet(); act({ t: 'end', sell: [...sel] }); };
    });
    return;
  }
  act({ t: 'end' });
}

function cardSheet(id, where) {
  if (!id || !CARDS[id]) return;
  const c = CARDS[id];
  const pub = snap && snap.pub, me = snap ? snap.mySeat : -1;
  const ask = snap && snap.pub ? myAsk() : null;
  const myP = pub && pub.players[me];
  const cost = myP ? E.costFor(pub, me, id) : c.cost;
  let btn = '';
  if (myP && ask === 'buy' && (where.slot != null || where.top)) btn = `<button class="btn primary" id="btn-buy" ${myP.en >= cost ? '' : 'disabled'}>Buy · ${cost}⚡</button>`;
  if (myP && ask === 'opp' && where.slot === pub.ask.i) btn = `<button class="btn primary" id="btn-buy">Buy · ${cost}⚡</button>`;
  if (myP && ask === 'buy' && where.k != null && E.has(pub, me, 'parasitic-tentacles')) {
    const f = E.findInst(pub, where.k);
    if (f && f.seat !== me) btn = `<button class="btn warm" id="btn-steal" ${myP.en >= cost ? '' : 'disabled'}>Take it · ${cost}⚡ to ${esc(pub.players[f.seat].name)}</button>`;
  }
  const m = STR.cards && STR.cards[id];
  const stat = m ? `<div class="row small"><span class="muted grow">Computers who bought it won</span><b class="pct" style="color:${scale((m.win - 0.15) / 0.25)}">${pct(m.win)}</b>${qTip('Measured over ' + (STR.measured ? STR.measured.cardGames || STR.measured.games : 'many') + ' four-player games between Easy computers, which buy cards at random, so every card gets tried; an average monster wins 25%. Cards bought by players already ahead score higher, so read it as a hint, not a law.')}</div>` : '';
  let amount = 0;
  const batt = id === 'monster-batteries' && pub && pub.edition === '2011' && btn.includes('btn-buy');
  openSheet(`${cardFace(id, 'pc big ' + (c.keep ? 'K' : 'D'), cost)}${stat}
    ${batt ? `<div class="row"><span class="grow">Energy to put on it <span class="muted small">(bank doubles it)</span></span><span class="stepper"><button data-d="-1">−</button><b id="amt">0</b><button data-d="1">+</button></span></div>` : ''}
    ${btn}<button class="btn ghost" id="btn-x">Close</button>`, el => {
    $('#btn-x', el).onclick = closeSheet;
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { amount = Math.max(0, Math.min(myP.en - cost, amount + +b.dataset.d)); $('#amt', el).textContent = amount; });
    const bb = $('#btn-buy', el);
    if (bb) bb.onclick = () => {
      closeSheet();
      if (ask === 'opp') act({ t: 'buy' });
      else if (where.top) act(Object.assign({ t: 'top' }, batt ? { amount } : {}));
      else act(Object.assign({ t: 'buy', i: where.slot }, batt ? { amount } : {}));
    };
    const bs = $('#btn-steal', el);
    if (bs) bs.onclick = () => { closeSheet(); act({ t: 'steal', k: where.k }); };
  });
}

function monsterSheet(i) {
  const pub = snap.pub, p = pub.players[i];
  const where = pub.tokyo.city === i ? 'in Tokyo City' : pub.tokyo.bay === i ? 'in Tokyo Bay' : p.alive ? 'outside Tokyo' : 'knocked out';
  openSheet(`<h3>${Art.monster(p.mon, 34)} ${esc(p.name)}</h3><span class="muted small">${monName(p.mon)} · ${where}${p.poison ? ` · ${p.poison} poison` : ''}${p.shrink ? ` · ${p.shrink} shrink` : ''}</span>
    <div class="row" style="gap:16px;font-size:15px"><span style="color:var(--hp)">${Art.icon('H', 16)} ${p.hp}/${p.maxHp}</span><span style="color:var(--vp)">${Art.icon('VP', 16)} ${p.vp}/20</span><span style="color:var(--en)">${Art.icon('E', 16)} ${p.en}</span></div>
    <div class="scroll" style="display:flex;flex-direction:column;gap:6px">${p.cards.length ? p.cards.map(c => `<div class="crow" data-card="${c.id}" data-k="${c.k}"><span>${Art.cardIcon(c.id, 18)}</span><div class="ct"><div class="cn">${esc(CARDS[c.id].name)}${c.c != null ? ' · ' + c.c + ' left' : ''}${c.as ? ' → ' + esc(CARDS[c.as].name) : ''}</div><div class="cx">${esc(CARDS[c.id].text)}</div></div></div>`).join('') : '<span class="muted small">No cards.</span>'}</div>
    <button class="btn ghost" id="btn-x">Close</button>`, el => {
    $('#btn-x', el).onclick = closeSheet;
    el.querySelectorAll('[data-card]').forEach(b => b.onclick = () => cardSheet(b.dataset.card, { k: +b.dataset.k }));
  });
}

function raySheet(pub, me) {
  ui.sheetKind = 'ray';
  const hearts = pub.t.dice.filter(d => d.f === 'H').length;
  const plan = {};
  const others = pub.players.map((p, i) => i).filter(i => i !== me && pub.players[i].alive && pub.players[i].hp < pub.players[i].maxHp);
  openSheet(`<h3>Healing Ray</h3><span class="muted small">Give some of your ${hearts} hearts to other monsters. They pay you 2⚡ per health (or all they have).</span>
    <div class="seats">${others.map(i => `<div class="seatrow">${Art.monster(pub.players[i].mon, 28)}<span class="nmx">${esc(pub.players[i].name)} <span class="muted small">♥${pub.players[i].hp} ⚡${pub.players[i].en}</span></span><span class="stepper"><button data-s="${i}" data-d="-1">−</button><b id="r${i}">0</b><button data-s="${i}" data-d="1">+</button></span></div>`).join('')}</div>
    <button class="btn primary" id="btn-rayok">Done</button>`, el => {
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
      const i = +b.dataset.s, used = Object.values(plan).reduce((a, x) => a + x, 0);
      const next = Math.max(0, (plan[i] || 0) + +b.dataset.d);
      if (next > (plan[i] || 0) && used >= hearts) return;
      plan[i] = Math.min(next, pub.players[i].maxHp - pub.players[i].hp); $('#r' + i, el).textContent = plan[i];
    });
    $('#btn-rayok', el).onclick = () => { closeSheet(); act({ t: 'ray', heal: plan }); };
  });
  ui.sheetKind = 'ray';
}

function mimicSheet(pub, me, required) {
  ui.sheetKind = 'mimic';
  const opts = E.mimicTargets(pub, me);
  openSheet(`<h3>Mimic: copy a card</h3><span class="muted small">${required ? 'Pick a keep card in play to copy.' : 'Switching costs 1 energy.'}</span>
    <div class="scroll" style="display:flex;flex-direction:column;gap:6px">${opts.map(o => `<div class="crow" data-k="${o.k}"><span>${Art.cardIcon(o.id, 18)}</span><div class="ct"><div class="cn">${esc(CARDS[o.id].name)} <span class="muted small">· ${esc(pub.players[o.seat].name)}</span></div><div class="cx">${esc(CARDS[o.id].text)}</div></div></div>`).join('')}</div>
    ${required ? '' : '<button class="btn ghost" id="btn-x">Cancel</button>'}`, el => {
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { closeSheet(); act({ t: 'mimic', k: +b.dataset.k }); });
    if ($('#btn-x', el)) $('#btn-x', el).onclick = closeSheet;
  });
  ui.sheetKind = 'mimic';
}

function oddsSheet(pub, me, ask) {
  if (ask !== 'roll') {
    const p = pub.players[me];
    if (!p) return;
    const dist = safeDist(pub, me);
    openSheet(`<h3>Damage before your next turn</h3><span class="muted small">If you stay in Tokyo with ${p.hp} health.</span>${dist}<button class="btn ghost" id="btn-x">Close</button>`, el => { $('#btn-x', el).onclick = closeSheet; });
    return;
  }
  const adv = safeAdvise(pub, me);
  if (!adv) return;
  const n = adv.faces.length, r = adv.r;
  const keepC = D.countsOf([...ui.keep].map(k => adv.faces[k]));
  const rows = [
    ['1-1-1 or better', c => c[0] >= 3], ['2-2-2 or better', c => c[1] >= 3], ['3-3-3 or better', c => c[2] >= 3],
    ['Any set of three', c => c[0] >= 3 || c[1] >= 3 || c[2] >= 3], ['2+ claws', c => c[5] >= 2], ['3+ claws', c => c[5] >= 3],
    ['2+ hearts', c => c[4] >= 2], ['3+ energy', c => c[3] >= 3],
  ].map(([lbl, pred]) => { const pr = r ? D.chance(n, keepC, r, pred) : (pred(adv.counts) ? 1 : 0); return `<div><span>${lbl}</span><b class="pct" style="color:${scale(pr)}">${pct(pr)}</b></div>`; }).join('');
  openSheet(`<h3>Chances with your keep</h3><span class="muted small">If you keep the raised dice and chase each goal with your ${r} reroll${r === 1 ? '' : 's'} left.</span>
    <div class="ogrid">${rows}</div><button class="btn ghost" id="btn-x">Close</button>`, el => { $('#btn-x', el).onclick = closeSheet; });
}
function safeDist(pub, me) {
  try {
    const d = Bots.damageDist(pub, me);
    const hp = pub.players[me].hp;
    const max = Math.max(...d);
    return `<div style="display:flex;align-items:flex-end;gap:3px;height:110px;padding-top:8px">${d.slice(0, 16).map((x, k) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px"><div style="width:100%;height:${Math.max(2, x / max * 84)}px;background:${k >= hp ? 'var(--bad)' : 'var(--accent)'};border-radius:3px 3px 0 0"></div><span class="muted" style="font-size:10px">${k}</span></div>`).join('')}</div>
      <span class="small muted">Bars: chance of each total damage. Red = knocks you out (${pct(Bots.koChance(pub, me, hp))}).</span>`;
  } catch (e) { return ''; }
}

function gameMenu() {
  const online = ui.mode === 'online';
  openSheet(`<h3>Game</h3>
    ${KT && COACH ? '<button class="btn" id="btn-rules1">Rules</button>' : ''}
    ${PF() ? `<button class="btn pf-open" id="btn-stats1">${window.Profile.avatarSVG(window.Profile.avatar, 22)}My stats</button>` : ''}
    ${online ? `<span class="muted small">Room ${esc(snap.code || '')}</span><button class="btn danger" id="btn-quit">Leave room</button>` : '<button class="btn danger" id="btn-quit">Quit this game</button>'}
    <button class="btn ghost" id="btn-x">Close</button>`, el => {
    $('#btn-x', el).onclick = closeSheet;
    if ($('#btn-rules1', el)) $('#btn-rules1', el).onclick = () => { closeSheet(); openRules(); };
    if ($('#btn-stats1', el)) $('#btn-stats1', el).onclick = () => openStats();
    // leaving a game after your first move counts as a loss in My stats
    $('#btn-quit', el).onclick = () => { closeSheet(); if (online) leaveOnline(); else { recordGame(); if (ui.tut) endTutorial(); closeRoom(); store.saved = null; save(); renderPlay(); } };
  });
}

function newGameFromEnd() {
  closeSheet();
  if (ui.mode === 'online') { leaveOnline(); return; }
  if (ui.tut) endTutorial();
  closeRoom(); store.saved = null; save(); renderPlay();
}

function showEnd() {
  if (!snap || !snap.pub) return;
  const pub = snap.pub, me = snap.mySeat;
  const order = pub.players.map((p, i) => i).sort((a, b) => (pub.winners.includes(b) - pub.winners.includes(a)) || (pub.players[b].alive - pub.players[a].alive) || pub.players[b].vp - pub.players[a].vp);
  const w = pub.winners.includes(me) ? me : pub.winners[0];
  const shared = pub.winners.length > 1;
  const title = w == null ? 'Nobody wins' : shared ? (pub.winners.includes(me) ? 'You share the win!' : pub.winners.map(i => pub.players[i].name).join(' & ') + ' share the win') : w === me ? 'You win!' : pub.players[w].name + ' wins!';
  const st = store.study || [];
  const lost = st.reduce((a, x) => a + x.lost, 0);
  const worst = st.slice().sort((a, b) => b.lost - a.lost).filter(x => x.lost >= 0.1).slice(0, 3);
  const study = st.length ? `<div class="panel" style="padding:10px"><div class="row"><span class="label grow">Your dice choices</span>${qTip('Each reroll you chose is compared with the best keep for your situation at that moment (exact odds, two rerolls ahead). Points lost add up what your keeps gave away on average.')}</div>
      <div class="row small"><span class="grow">${st.length} choices · ${st.filter(x => x.lost < 0.05).length} were the best keep</span><b class="lost" style="color:${scale(1 - lost / 8)}">−${fmt1(lost)} pts</b></div>
      ${worst.map(x => `<div class="row small muted"><span class="grow">Turn ${x.turn}: ${[...x.faces].map(f => Art.face(f, 15)).join('')}</span><span>−${fmt1(x.lost)}</span></div>`).join('')}</div>` : '';
  openSheet(`<div class="endcard"><div class="win">${w != null ? Art.monster(pub.players[w].mon, 64) : ''}<div><b>${esc(title)}</b><span class="muted">${pub.why === 'points' ? '20 points reached' : pub.why === 'last' ? 'Last monster standing' : 'Everyone fell at once'} · turn ${pub.turnNo}</span></div></div>
    <table class="res"><tr><th>Monster</th><th>★</th><th>♥</th><th>Cards</th></tr>${order.map(i => { const p = pub.players[i]; return `<tr><td>${esc(i === me ? 'You' : p.name)}</td><td>${p.vp}</td><td>${p.alive ? p.hp : 'out'}</td><td>${p.cards.length}</td></tr>`; }).join('')}</table>
    ${study}
    ${statsLine()}
    <div class="row"><button class="btn primary grow" id="btn-again2">New game</button>${ui.game && ui.game.tl.length > 1 ? '<button class="btn" id="btn-review2">Review</button>' : ''}<button class="btn" id="btn-x">Close</button></div></div>`, el => {
    $('#btn-x', el).onclick = closeSheet;
    $('#btn-again2', el).onclick = () => newGameFromEnd();
    if ($('#btn-review2', el)) $('#btn-review2', el).onclick = () => reviewSheet();
  });
}

// ------------------------------------------------------------------ Undo (local games, not the Daily or the guided game)
function undoMode() { return ui.mode === 'local' && !!ui.game && !ui.tut && !ui.game.daily && !!ui.rng; }
function canUndo() { return undoMode() && !!ui.game.undo && !!snap && !!snap.pub && !snap.pub.over; }
// the table goes back to just before your last move, with the dice stream where it was (the same dice come back)
function undo() {
  if (!canUndo()) return;
  const g = ui.game, u = g.undo;
  closeSheet(); closePop();
  const meta = Object.assign({}, g, { undo: null, helped: true, tl: g.tl.filter(f => f.n <= u.state.turnNo) });
  store.study.length = Math.min(store.study.length, u.study);
  store.keepSel = null; ui.lastRoll = null;
  const wasSaved = { state: u.state, kinds: u.state.players.map(p => p.kind), meta, rs: u.rs };
  startLocal(wasSaved, true);
  toast('Took back your last move. This game now counts as “with help”.');
}

// ------------------------------------------------------------------ My stats (js/profile.js + js/kotprofile.js)
// one result per game; quitting after your first move counts as a loss; Undo makes it "with help" (not rated);
// the guided first game never counts
function recordFrom(st, me, g, online) {
  const P = PF();
  if (!P || !g || g.recorded || g.tut) return;
  if (!st.over && !g.moved) return;
  g.recorded = true;
  try {
    const r = KP.result({ st, me, helped: g.helped, daily: !!g.daily, online, tokyoTurns: g.tokyoTurns });
    if (g.daily) r.date = g.daily;   // a Daily finished after midnight still belongs to the day it was dealt
    P.recordResult(r);
  } catch (e) { /* the stats never stop the game */ }
}
function recordGame() {
  if (!snap || !snap.pub || ui.tut || !ui.game) return;
  if (ui.mode === 'local' && room && room.state) recordFrom(room.state, snap.mySeat, ui.game, false);
  else if (ui.mode === 'online' && snap.pub.over && snap.mySeat >= 0) {
    // online: once per room (a reload shows the same finished room again)
    const key = (snap.code || '') + ':' + snap.pub.turnNo;
    if (store.recOnline === key) return;
    store.recOnline = key; save();
    recordFrom(snap.pub, snap.mySeat, ui.game, true);
  }
}
// a saved game replaced by a new one (setup's New game)
function recordSaved(sv) {
  if (!sv || sv.tut || !sv.state || !Array.isArray(sv.kinds)) return;
  const me = sv.kinds.indexOf('human');
  if (me >= 0) recordFrom(sv.state, me, cleanMeta(sv.meta), false);
}
function dailyDone() { try { return !!(PF() && window.Profile.daily.played()); } catch (e) { return false; } }
function startDaily() {
  const P = PF();
  if (!P) return;
  if (ui.mode === 'online') { toast('Leave the online room first.'); return; }
  if (dailyDone()) { openStats('daily'); return; }
  if (room && snap && snap.pub && !snap.pub.over) { toast('Finish or quit this game first.'); return; }
  if (P.isOpen()) P.closePanel();
  if (store.saved) { recordSaved(store.saved); store.saved = null; save(); }
  const day = P.daily.date();
  if (ui.tab !== 'play') setTab('play', true);
  startLocal(null, false, false, { day, seed: (P.daily.seed(day, 'king-of-tokyo') >>> 0) || 1 });
}
function openStats(t) {
  const P = PF();
  if (!P) return;
  closeSheet(); closePop();
  P.openPanel(t ? { tab: t } : undefined);
  if (P.isOpen()) { ui.pfOpen = true; history.pushState({ tab: ui.tab, modal: 'profile' }, '', '#' + ui.tab); }
}
// a line on the end card: how this game counted
function statsLine() {
  const g = ui.game;
  if (!PF() || !g || ui.tut) return '';
  const why = ui.mode === 'online' ? 'Counted in My stats (online).' : g.helped ? 'Counted as “with help” (Undo): not rated.' : g.daily ? 'Today’s Daily game is in My stats.' : 'Counted in My stats.';
  return `<div class="row small muted"><span class="grow">${why}</span><button class="btn small pf-open" id="btn-stats2">My stats</button></div>`;
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#btn-stats2')) openStats(); });

// ------------------------------------------------------------------ the turn-by-turn timeline (end-of-game review)
// one frame per turn: every monster's ♥ ★ ⚡, who is in Tokyo, and the key moments of the turn before
const KEY_MOMENT = /enters Tokyo|moves from Tokyo|leaves Tokyo|out of Tokyo|knocked out|buys|wins|^deals /i;
function frameOf(pub) {
  return { n: pub.turnNo, c: pub.cur, tk: [pub.tokyo.city, pub.tokyo.bay], p: pub.players.map(p => [p.hp, p.vp, p.en, p.alive ? 1 : 0, p.cards.length]), m: [] };
}
function track(prev, s) {
  const pub = s && s.pub, g = ui.game;
  if (!pub || !pub.players) return;
  if (ui.mode === 'online' && (!g || g.code !== s.code)) ui.game = newMeta({ code: s.code });
  const G = ui.game;
  if (!G) return;
  const tl = G.tl, last = tl[tl.length - 1];
  if (!last || last.n !== pub.turnNo || pub.over && !last.end) {
    // the turn that just ended: its key log lines go on its frame
    if (last) {
      const lines = pub.log.filter(l => l.n === last.n && KEY_MOMENT.test(l.m)).slice(-6);
      last.m = lines.map(l => (l.s >= 0 && pub.players[l.s] && !l.m.startsWith(pub.players[l.s].name + ' ') ? pub.players[l.s].name + ' ' : '') + l.m);
      if (last.n === pub.turnNo) { Object.assign(last, frameOf(pub), { m: last.m, end: true }); return; }
    }
    const f = frameOf(pub);
    if (pub.over) f.end = true;
    tl.push(f);
    if (tl.length > 160) tl.splice(0, tl.length - 160);
    // a turn you start in Tokyo (for the achievement)
    const me = s.mySeat;
    if (!pub.over && pub.cur === me && me >= 0 && (pub.tokyo.city === me || pub.tokyo.bay === me)) G.tokyoTurns++;
  } else last.p = frameOf(pub).p;
}
// the review: a star race (one line per monster), then step through the turns
function reviewSheet() {
  const g = ui.game;
  if (!g || g.tl.length < 2 || !snap || !snap.pub) return;
  const pub = snap.pub, me = snap.mySeat, tl = g.tl, P = pub.players;
  let at = tl.length - 1;
  const col = i => (MONSTERS[P[i].mon] ? MONSTERS[P[i].mon].color : '#888');
  const W = 300, H = 120, x = k => 8 + k * (W - 16) / Math.max(1, tl.length - 1), y = v => H - 8 - Math.min(20, v) * (H - 16) / 20;
  const lines = P.map((p, i) => `<polyline fill="none" stroke="${col(i)}" stroke-width="${i === me ? 3 : 2}" stroke-linejoin="round" points="${tl.map((f, k) => x(k).toFixed(1) + ',' + y(f.p[i] ? f.p[i][1] : 0).toFixed(1)).join(' ')}"/>`).join('');
  const chart = cur => `<svg class="rv-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Stars by turn"><line x1="8" x2="${W - 8}" y1="${y(20)}" y2="${y(20)}" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 4"/>${lines}<line class="rv-cur" x1="${x(cur)}" x2="${x(cur)}" y1="4" y2="${H - 4}" stroke="rgba(255,255,255,.6)"/></svg>`;
  const body = k => {
    const f = tl[k], nm = i => (i === me ? 'You' : esc(P[i].name));
    const who = f.end ? 'End of the game' : f.c >= 0 && P[f.c] ? `Turn ${f.n}: ${nm(f.c)}` : `Turn ${f.n}`;
    const rows = P.map((p, i) => { const q = f.p[i] || [0, 0, 0, 0, 0]; const tk = f.tk[0] === i ? ' <span class="rv-tk">CITY</span>' : f.tk[1] === i ? ' <span class="rv-tk bay">BAY</span>' : ''; return `<tr class="${q[3] ? '' : 'out'}${i === me ? ' me' : ''}"><td><span class="rv-dot" style="background:${col(i)}"></span>${nm(i)}${tk}</td><td>${q[3] ? q[0] : 'out'}</td><td>${q[1]}</td><td>${q[2]}</td><td>${q[4]}</td></tr>`; }).join('');
    const moments = (tl[k].m || []).map(m => `<li>${esc(m)}</li>`).join('');
    return `<div class="row"><b class="grow">${who}</b><span class="muted small">${k + 1} / ${tl.length}</span></div>
      <table class="res"><tr><th>Monster</th><th>♥</th><th>★</th><th>⚡</th><th>Cards</th></tr>${rows}</table>
      <ul class="log rv-m">${moments || (k < tl.length - 1 ? '<li class="muted">No big moments this turn.</li>' : '')}</ul>`;
  };
  openSheet(`<h3>Game review</h3><span class="muted small">★ by turn (dashed line = 20). Step through the turns below.</span>
    <div id="rv-chart">${chart(at)}</div>
    <div class="row"><button class="btn" id="rv-prev" aria-label="Previous turn">‹</button><input type="range" class="grow" id="rv-at" min="0" max="${tl.length - 1}" value="${at}" aria-label="Turn"><button class="btn" id="rv-next" aria-label="Next turn">›</button></div>
    <div id="rv-body" class="rv-body">${body(at)}</div>
    <button class="btn ghost" id="btn-x">Close</button>`, el => {
    const go = k => { at = Math.max(0, Math.min(tl.length - 1, k)); $('#rv-at', el).value = at; $('#rv-chart', el).innerHTML = chart(at); $('#rv-body', el).innerHTML = body(at); };
    $('#rv-prev', el).onclick = () => go(at - 1);
    $('#rv-next', el).onclick = () => go(at + 1);
    $('#rv-at', el).oninput = e => go(+e.target.value);
    $('#btn-x', el).onclick = closeSheet;
  });
}

// ================================================================== ODDS tab (also a table companion)
const oz = { faces: ['1', '1', 'C', 'H', 'E', '2'], r: 2, hp: 10, tokyo: false, outside: 3, ohp: 10 };
function renderOdds() {
  const v = $('#v-odds');
  // a fake public state so the same advice code runs
  const n = oz.faces.length;
  const players = [{ hp: oz.tokyo ? 10 : oz.hp, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0, mon: 0 }];
  for (let i = 0; i < Math.max(1, oz.outside); i++) players.push({ hp: 10, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0, mon: i + 1 });
  players[0].hp = oz.hp;
  const fake = { players, tokyo: { city: oz.tokyo ? 0 : 1, bay: -1 }, bayRule: false, t: { seat: 0, dice: oz.faces.map(f => ({ f, k: false })), rerolls: oz.r, less: 6 - n } };
  let adv = null;
  try { adv = Bots.advise(fake, 0); } catch (e) { adv = null; }
  const best = adv ? new Set(adv.keep) : new Set();
  const counts = D.countsOf(oz.faces);
  const rows = [['1-1-1 or better', c => c[0] >= 3], ['2-2-2 or better', c => c[1] >= 3], ['3-3-3 or better', c => c[2] >= 3], ['Any set of three', c => c[0] >= 3 || c[1] >= 3 || c[2] >= 3], ['2+ claws', c => c[5] >= 2], ['3+ claws', c => c[5] >= 3], ['2+ hearts', c => c[4] >= 2], ['3+ energy', c => c[3] >= 3]]
    .map(([l, pred]) => { const pr = oz.r ? D.solver(n, c => (pred(c) ? 1 : 0)).ev(counts, oz.r) : (pred(counts) ? 1 : 0); return `<div><span>${l}</span><b class="pct" style="color:${scale(pr)}">${pct(pr)}</b></div>`; }).join('');
  // Tokyo calculator: fake board with `outside` monsters attacking me in Tokyo
  const tp = [{ hp: oz.ohp, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0 }];
  for (let i = 0; i < oz.outside; i++) tp.push({ hp: 10, vp: 0, en: 0, alive: true, cards: [], poison: 0, shrink: 0 });
  const tState = { players: tp, tokyo: { city: 0, bay: -1 }, bayRule: false, t: null };
  let ko = 0, dist = [];
  try { ko = Bots.koChance(tState, 0, oz.ohp); dist = Bots.damageDist(tState, 0); } catch (e) { /* */ }
  const mx = Math.max(...dist, 0.0001);
  const step = (id, val) => `<span class="stepper"><button data-st="${id}" data-d="-1">−</button><b>${val}</b><button data-st="${id}" data-d="1">+</button></span>`;
  v.innerHTML = `<div class="oddsv">
    <div class="panel">
      <div class="row"><span class="label grow">Your dice</span>${qTip('Tap a die to change its face (works with your real dice at the table). The green dots show the keep with the most expected points: stars from sets, plus energy, hearts and claws valued for your situation.')}</div>
      <div class="dice" id="oz-dice">${oz.faces.map((f, k) => `<button class="die${best.has(k) ? ' kept hint' : ''}" data-oz="${k}">${Art.face(f, 24, DIE_INK)}</button>`).join('')}</div>
      <div class="row"><span class="grow small">Rerolls left</span><div class="seg" style="width:150px">${[0, 1, 2].map(r => `<button data-r="${r}" aria-pressed="${oz.r === r}">${r}</button>`).join('')}</div></div>
      <div class="row"><span class="grow small">Dice</span>${step('n', n)}<span class="grow small" style="text-align:right">Health</span>${step('hp', oz.hp)}</div>
      <div class="row"><span class="grow small">I'm in Tokyo</span><label class="switch"><input type="checkbox" id="oz-tokyo" ${oz.tokyo ? 'checked' : ''}><span></span></label></div>
      <div class="row small"><span class="grow">${oz.r ? 'Best keep is worth' : 'These dice are worth'}</span><b>${adv ? fmt1(Math.max(0, adv.ev)) : '–'} pts</b></div>
    </div>
    <div class="panel scroll">
      <span class="label">Chances if you chase it</span>
      <div class="ogrid">${rows}</div>
      <div class="row" style="margin-top:6px"><span class="label grow">Stay in Tokyo?</span>${qTip('Each monster outside Tokyo rolls once before your next turn. Each of their dice is assumed to end as a claw ' + Math.round(Bots.CFG.claw * 100) + '% of the time, measured from computer games. Red bars knock you out.')}</div>
      <div class="row"><span class="grow small">Your health</span>${step('ohp', oz.ohp)}<span class="grow small" style="text-align:right">Outside</span>${step('out', oz.outside)}</div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:76px">${dist.slice(0, 16).map((x, k) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px"><div style="width:100%;height:${Math.max(2, x / mx * 58)}px;background:${k >= oz.ohp ? 'var(--bad)' : 'var(--accent)'};border-radius:3px 3px 0 0"></div><span class="muted" style="font-size:9.5px">${k}</span></div>`).join('')}</div>
      <div class="row"><span class="grow">Knock-out risk</span><b class="pct" style="color:${scale(1 - ko / 0.5)}">${pct(ko)}</b><span class="muted small">${ko > 0.22 ? 'Hard leaves' : 'Hard stays'}</span></div>
    </div>
  </div>`;
  v.querySelectorAll('[data-oz]').forEach(b => b.onclick = () => { const k = +b.dataset.oz; oz.faces[k] = D.FACES[(D.FACES.indexOf(oz.faces[k]) + 1) % 6]; renderOdds(); });
  v.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { oz.r = +b.dataset.r; renderOdds(); });
  $('#oz-tokyo', v).onchange = e => { oz.tokyo = e.target.checked; renderOdds(); };
  v.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
    const d = +b.dataset.d, id = b.dataset.st;
    if (id === 'n') { const n2 = Math.max(4, Math.min(8, oz.faces.length + d)); while (oz.faces.length < n2) oz.faces.push('1'); oz.faces.length = n2; }
    if (id === 'hp') oz.hp = Math.max(1, Math.min(12, oz.hp + d));
    if (id === 'ohp') oz.ohp = Math.max(1, Math.min(12, oz.ohp + d));
    if (id === 'out') oz.outside = Math.max(1, Math.min(5, oz.outside + d));
    renderOdds();
  });
}

// ================================================================== CARDS tab
const cz = { filter: 'all', sort: 'cost' };
function renderCards() {
  const v = $('#v-cards');
  const ed = store.settings.edition;
  syncEd(ed);
  let list = Object.values(CARDS);
  if (cz.filter !== 'all') list = list.filter(c => (cz.filter === 'keep') === c.keep);
  const val = id => (STR.cards && STR.cards[id] ? STR.cards[id].win : -1);
  list.sort((a, b) => (cz.sort === 'cost' ? a.cost - b.cost || a.name.localeCompare(b.name) : val(b.id) - val(a.id)));
  const total = Object.values(CARDS).reduce((a, c) => a + c.copies, 0);
  v.innerHTML = `<div class="cardsv">
    <div class="row"><span class="label grow">${EDITIONS[ed]} · ${total} cards</span>${qTip('Win % = how often computers who bought the card went on to win, in measured four-player games (25% is average). Change the edition in Settings.')}</div>
    <div class="row"><div class="seg grow">${[['all', 'All'], ['keep', 'Keep'], ['discard', 'Discard']].map(([k, l]) => `<button data-f="${k}" aria-pressed="${cz.filter === k}">${l}</button>`).join('')}</div>
      <div class="seg" style="width:150px">${[['cost', 'Cost'], ['value', 'Win %']].map(([k, l]) => `<button data-s="${k}" aria-pressed="${cz.sort === k}">${l}</button>`).join('')}</div></div>
    <div class="scroll" style="flex:1"><div class="clist">${list.map(c => { const m = STR.cards && STR.cards[c.id]; return `<div class="crow" data-card="${c.id}"><span>${Art.cardIcon(c.id, 20)}</span>
      <div class="ct"><div class="cn">${esc(c.name)}${c.copies > 1 ? ' <span class="muted small">×' + c.copies + '</span>' : ''} <span class="tagk ${c.keep ? 'K' : 'D'}">${c.keep ? 'KEEP' : 'DISCARD'}</span></div><div class="cx">${esc(c.text)}</div></div>
      ${costTag(c.cost)}<div class="cv">${m ? `<span class="pct" style="color:${scale((m.win - 0.15) / 0.25)}">${pct(m.win)}</span>win` : ''}</div></div>`; }).join('')}</div></div>
  </div>`;
  v.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { cz.filter = b.dataset.f; renderCards(); });
  v.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { cz.sort = b.dataset.s; renderCards(); });
  v.querySelectorAll('[data-card]').forEach(b => b.onclick = () => cardSheet(b.dataset.card, {}));
}

// ================================================================== SETTINGS
function renderSettings() {
  const v = $('#v-settings'), st = store.settings;
  const L = STR.levels || {};
  const strengthTip = STR.measured
    ? `Measured over ${STR.measured.games} games each: ${Object.keys(L).map(k => L[k]).join(' ')}`
    : 'Strength numbers appear after the measurement run.';
  const seg = (key, opts) => `<div class="seg">${opts.map(([k, l]) => `<button data-k="${key}" data-v="${k}" aria-pressed="${String(st[key]) === String(k)}">${l}</button>`).join('')}</div>`;
  v.innerHTML = `<div class="set scroll">
    <div class="panel"><div class="row"><span class="label grow">Computer level</span>${qTip(esc(strengthTip))}</div>${seg('level', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']])}</div>
    <div class="panel"><div class="row"><span class="label grow">Card deck</span>${qTip('Both decks have the same 66 cards. 2016 renamed 8 of them, made Battery Monster cost 3, lets cards add claws, and always sends the first monster into an empty Tokyo. Takes effect in your next game.')}</div>${seg('edition', [['2016', '2016 edition'], ['2011', '2011 edition']])}</div>
    <div class="panel">
      <div class="setrow"><div class="grow"><b>Tokyo Bay</b><span>Second Tokyo spot with 5–6 monsters</span></div><label class="switch"><input type="checkbox" data-sw="bay" ${st.bay ? 'checked' : ''}><span></span></label></div>
      <div class="setrow"><div class="grow"><b>Two-player variant</b><span>With 2 monsters, Tokyo pays energy instead of points${st.edition === '2011' ? ' · 2016 deck only' : ''}</span></div><label class="switch"><input type="checkbox" data-sw="duel" ${st.duel && st.edition !== '2011' ? 'checked' : ''} ${st.edition === '2011' ? 'disabled' : ''}><span></span></label></div>
      <div class="setrow"><div class="grow"><b>Best-keep dots</b><span>Green dot under the best dice to keep</span></div><label class="switch"><input type="checkbox" data-sw="hints" ${st.hints ? 'checked' : ''}><span></span></label></div>
      <div class="setrow"><div class="grow"><b>Computer speed</b></div><div style="width:170px">${seg('speed', [['normal', 'Normal'], ['fast', 'Fast']])}</div></div>
    </div>
    <div class="panel"><div class="row"><span class="label grow">Sound &amp; effects</span></div><div id="fx-box"></div></div>
    ${KT && COACH ? `<div class="panel"><div class="row"><span class="label grow">How to play</span></div><div class="row"><button class="btn grow" id="btn-rules2">Rules</button><button class="btn grow" id="btn-tut">Replay tutorial</button></div></div>` : ''}
    <div class="ver">King of Tokyo Lab ${VERSION} · fan-made study tool, not affiliated with the publisher · <a href="../">All games</a></div>
  </div>`;
  v.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    st[b.dataset.k] = b.dataset.v; save(); renderSettings();
    // a new computer speed counts at once: the running game carries on from the same moment at the new pace
    if (b.dataset.k === 'speed' && ui.mode === 'local' && room && room.state && !room.state.over) {
      const wasTut = ui.tut;
      startLocal(Object.assign({ state: room.state, kinds: room.state.players.map(p => p.kind) }, wasTut ? { tut: true } : {}), true);
      if (wasTut && ui.tut && tour) tour.resume();
    }
  });
  v.querySelectorAll('[data-sw]').forEach(i => i.onchange = () => { st[i.dataset.sw] = i.checked; save(); });
  FX.renderSettings($('#fx-box', v));
  if ($('#btn-rules2', v)) $('#btn-rules2', v).onclick = () => openRules();
  if ($('#btn-tut', v)) $('#btn-tut', v).onclick = () => startTutorial();
}

// ================================================================== boot
if (KP) KP.init(() => startDaily());
if (window.Profile) window.Profile.onChange(what => {
  // the panel closed by ✕ / outside tap: drop the history entry it pushed
  if (what === 'close' && ui.pfOpen) { ui.pfOpen = false; try { history.back(); } catch (e) { /* */ } }
  if ((what === 'result' || what === 'me' || what === 'import' || what === 'reset') && ui.tab === 'play' && !room) renderPlay();
});
// a new deploy reloads the page by itself only when nothing would be lost
if (window.PWA) window.PWA.safeToReload = () => {
  if (ui.mode === 'online' || ui.sheetOpen || ui.pfOpen) return false;
  if ((COACH && COACH.rulesOpen()) || (window.Profile && window.Profile.isOpen())) return false;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  if (ui.tut) return false;
  // a game in progress is saved, but only the Play tab shows it moving: reload only away from it
  if (ui.tab !== 'play') return true;
  if (store.saved) return false;
  return !room || !snap || !snap.pub || snap.pub.over;
};
if (history.state && history.state.modal) history.back();
setTab((location.hash || '#play').slice(1), false);
if (store.online) {
  ui.mode = 'online'; snap = { status: 'joining' }; renderPlay();
  loadOnline().then(r => { room = r; return r.resume(); }).then(ok => {
    if (!ok) { store.online = false; save(); ui.mode = null; room = null; snap = null; }
    renderPlay();
  }).catch(() => { store.online = false; save(); ui.mode = null; room = null; snap = null; renderPlay(); });
}
window.__kot = { get snap() { return snap; }, get room() { return room; }, act, get tour() { return tour; }, get tut() { return !!ui.tut; }, get game() { return ui.game; }, undo, canUndo, startDaily, reviewSheet, openStats, setTab };
